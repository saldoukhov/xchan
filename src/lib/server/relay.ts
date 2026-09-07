import { commitOfPairing } from '$lib/crypto/hash';
import { PAIRING_MS } from '$lib/pairing';
import {
	MAX_CONCURRENT_PER_IP,
	MAX_QUEUE,
	PairLimiter,
	PENDING_ADMIT_MS,
	pairingLimitKey
} from './pair-limit';
import type { SseSink } from './sse';

export { PAIRING_MS };
export const MAX_CIPHERTEXT_BYTES = 64 * 1024;
export const MAX_NAME_CHARS = 64;

export type PairingAdmission =
	{ ok: true } | { ok: false; status: 429 | 503; retryAfterSec: number; message: string };

type PairingEntry = {
	commit: string;
	publicKey: string | null;
	identityPublicKey: string;
	name: string;
	ip: string;
	sink: SseSink;
	timer: ReturnType<typeof setTimeout>;
	peer: PairingEntry | null;
};

export type RevealResult = 'ok' | 'unknown' | 'mismatch' | 'too_early';

type ReadySession = {
	self: string;
	peer: string;
	name: string;
	sink: SseSink;
};

type PendingAdmit = {
	ip: string;
	expiresAt: number;
};

const pairingQueue: PairingEntry[] = [];
const pendingAdmits = new Map<string, PendingAdmit>();
const readySessions = new Map<string, ReadySession>();
const limiter = new PairLimiter();

let nowOverride: number | null = null;

function now(): number {
	return nowOverride ?? Date.now();
}

function withRetry(message: string, retryAfterSec: number): string {
	return `${message} Try again in ${retryAfterSec}s.`;
}

function prunePending(at: number): void {
	for (const [publicKey, pending] of pendingAdmits) {
		if (pending.expiresAt <= at) pendingAdmits.delete(publicKey);
	}
}

function waiterSnapshots(at: number): { commit: string; ip: string }[] {
	prunePending(at);
	const byKey = new Map<string, string>();
	for (const entry of pairingQueue) {
		byKey.set(entry.commit, entry.ip);
	}
	for (const [commit, pending] of pendingAdmits) {
		if (!byKey.has(commit)) byKey.set(commit, pending.ip);
	}
	return [...byKey].map(([commit, ip]) => ({ commit, ip }));
}

export function admitPairing(commit: string, ip: string): PairingAdmission {
	const at = now();
	const waiters = waiterSnapshots(at);
	if (waiters.some((waiter) => waiter.commit === commit)) {
		const pending = pendingAdmits.get(commit);
		if (pending) {
			pendingAdmits.set(commit, { ip, expiresAt: at + PENDING_ADMIT_MS });
		}
		return { ok: true };
	}

	if (waiters.length >= MAX_QUEUE) {
		const retryAfterSec = Math.ceil(PAIRING_MS / 1000);
		return {
			ok: false,
			status: 503,
			retryAfterSec,
			message: withRetry('Pairing is busy.', retryAfterSec)
		};
	}

	const key = pairingLimitKey(ip);
	const concurrent = waiters.filter((waiter) => pairingLimitKey(waiter.ip) === key).length;
	if (concurrent >= MAX_CONCURRENT_PER_IP) {
		const retryAfterSec = Math.ceil(PAIRING_MS / 1000);
		return {
			ok: false,
			status: 429,
			retryAfterSec,
			message: withRetry('This network already has pairing in progress.', retryAfterSec)
		};
	}

	const globalMatchRetry = limiter.globalMatchRetryAfter(at);
	if (globalMatchRetry !== null) {
		return {
			ok: false,
			status: 429,
			retryAfterSec: globalMatchRetry,
			message: withRetry('Too many recent pairings.', globalMatchRetry)
		};
	}

	const matchRetry = limiter.matchRetryAfter(key, at);
	if (matchRetry !== null) {
		return {
			ok: false,
			status: 429,
			retryAfterSec: matchRetry,
			message: withRetry('Too many recent pairings.', matchRetry)
		};
	}

	const joinRetry = limiter.joinRetryAfter(key, at);
	if (joinRetry !== null) {
		return {
			ok: false,
			status: 429,
			retryAfterSec: joinRetry,
			message: withRetry('Too many pairing attempts.', joinRetry)
		};
	}

	limiter.recordJoin(key, at);
	pendingAdmits.set(commit, { ip, expiresAt: at + PENDING_ADMIT_MS });
	return { ok: true };
}

function removePairing(commit: string, reason: 'timeout' | 'cancelled'): boolean {
	const index = pairingQueue.findIndex((entry) => entry.commit === commit);
	if (index === -1) return false;
	const [entry] = pairingQueue.splice(index, 1);
	clearTimeout(entry.timer);
	const peer = entry.peer;
	entry.peer = null;
	entry.sink.send({ type: reason });
	entry.sink.close();
	if (peer) {
		peer.peer = null;
		removePairing(peer.commit, 'cancelled');
	}
	return true;
}

function recordPairMatch(a: PairingEntry, b: PairingEntry): void {
	const at = now();
	const keys = new Set([pairingLimitKey(a.ip), pairingLimitKey(b.ip)]);
	for (const key of keys) {
		limiter.recordMatch(key, at);
	}
	limiter.recordGlobalMatch(at);
}

function tryMatch(): void {
	for (;;) {
		const unmatched = pairingQueue.filter((entry) => !entry.peer);
		if (unmatched.length < 2) return;
		const aEntry = unmatched[0];
		const bEntry = unmatched.find(
			(entry) =>
				entry.commit !== aEntry.commit && entry.identityPublicKey !== aEntry.identityPublicKey
		);
		if (!bEntry) return;
		aEntry.peer = bEntry;
		bEntry.peer = aEntry;
		aEntry.sink.send({ type: 'reveal', peerCommit: bEntry.commit });
		bEntry.sink.send({ type: 'reveal', peerCommit: aEntry.commit });
	}
}

function completePair(aEntry: PairingEntry, bEntry: PairingEntry): void {
	if (!aEntry.publicKey || !bEntry.publicKey) return;
	if (aEntry.identityPublicKey === bEntry.identityPublicKey) {
		rejectSameDevice(aEntry, bEntry);
		return;
	}
	recordPairMatch(aEntry, bEntry);
	aEntry.peer = null;
	bEntry.peer = null;
	const aIndex = pairingQueue.indexOf(aEntry);
	if (aIndex !== -1) pairingQueue.splice(aIndex, 1);
	const bIndex = pairingQueue.indexOf(bEntry);
	if (bIndex !== -1) pairingQueue.splice(bIndex, 1);
	clearTimeout(aEntry.timer);
	clearTimeout(bEntry.timer);
	aEntry.sink.send({
		type: 'paired',
		peerPublicKey: bEntry.publicKey,
		peerIdentityPublicKey: bEntry.identityPublicKey,
		peerName: bEntry.name,
		peerIp: bEntry.ip
	});
	bEntry.sink.send({
		type: 'paired',
		peerPublicKey: aEntry.publicKey,
		peerIdentityPublicKey: aEntry.identityPublicKey,
		peerName: aEntry.name,
		peerIp: aEntry.ip
	});
	queueMicrotask(() => {
		aEntry.sink.close();
		bEntry.sink.close();
	});
}

function rejectSameDevice(aEntry: PairingEntry, bEntry: PairingEntry): void {
	aEntry.peer = null;
	bEntry.peer = null;
	const aIndex = pairingQueue.indexOf(aEntry);
	if (aIndex !== -1) pairingQueue.splice(aIndex, 1);
	const bIndex = pairingQueue.indexOf(bEntry);
	if (bIndex !== -1) pairingQueue.splice(bIndex, 1);
	clearTimeout(aEntry.timer);
	clearTimeout(bEntry.timer);
	aEntry.sink.send({ type: 'rejected', reason: 'same-device' });
	bEntry.sink.send({ type: 'rejected', reason: 'same-device' });
	queueMicrotask(() => {
		aEntry.sink.close();
		bEntry.sink.close();
	});
}

export function joinPairing(
	commit: string,
	identityPublicKey: string,
	name: string,
	ip: string,
	sink: SseSink
): () => void {
	const alreadyWaiting =
		pendingAdmits.has(commit) || pairingQueue.some((entry) => entry.commit === commit);
	if (!alreadyWaiting) {
		const admitted = admitPairing(commit, ip);
		if (!admitted.ok) {
			throw new PairingRejected(admitted);
		}
	}
	pendingAdmits.delete(commit);
	removePairing(commit, 'cancelled');
	const entry: PairingEntry = {
		commit,
		publicKey: null,
		identityPublicKey,
		name,
		ip,
		sink,
		peer: null,
		timer: setTimeout(() => {
			removePairing(commit, 'timeout');
		}, PAIRING_MS)
	};
	pairingQueue.push(entry);
	sink.send({ type: 'waiting' });
	tryMatch();
	return () => {
		removePairing(commit, 'cancelled');
	};
}

export async function revealPairing(
	commit: string,
	publicKey: string,
	identityPublicKey: string
): Promise<RevealResult> {
	const entry = pairingQueue.find((item) => item.commit === commit);
	if (!entry) return 'unknown';
	if (!entry.peer) return 'too_early';
	if (identityPublicKey !== entry.identityPublicKey) return 'mismatch';
	const expected = await commitOfPairing(publicKey, identityPublicKey);
	if (expected !== commit) return 'mismatch';
	entry.publicKey = publicKey;
	if (entry.peer.publicKey && entry.peer.identityPublicKey) {
		completePair(entry, entry.peer);
	}
	return 'ok';
}

export class PairingRejected extends Error {
	readonly admission: Extract<PairingAdmission, { ok: false }>;

	constructor(admission: Extract<PairingAdmission, { ok: false }>) {
		super(admission.message);
		this.name = 'PairingRejected';
		this.admission = admission;
	}
}

export function cancelPairing(commit: string): boolean {
	return removePairing(commit, 'cancelled');
}

function notifyPeerStatus(self: string, peer: string, ready: boolean, name: string): void {
	const inverse = readySessions.get(peer);
	if (inverse && inverse.peer === self) {
		inverse.sink.send({ type: 'status', ready, peerName: name });
	}
}

export function joinChannel(self: string, peer: string, name: string, sink: SseSink): () => void {
	const previous = readySessions.get(self);
	if (previous) {
		previous.sink.close();
	}
	readySessions.set(self, { self, peer, name, sink });
	const inverse = readySessions.get(peer);
	const ready = Boolean(inverse && inverse.peer === self);
	sink.send({ type: 'status', ready, peerName: ready ? inverse!.name : undefined });
	if (ready) {
		notifyPeerStatus(self, peer, true, name);
	}
	return () => {
		const current = readySessions.get(self);
		if (current?.sink === sink) {
			readySessions.delete(self);
			notifyPeerStatus(self, peer, false, name);
		}
	};
}

export function sendCiphertext(from: string, to: string, ciphertext: string): boolean {
	const session = readySessions.get(to);
	if (!session || session.peer !== from) return false;
	session.sink.send({ type: 'message', ciphertext });
	return true;
}

export function setRelayNowForTests(ms: number | null): void {
	nowOverride = ms;
}

export function resetRelayForTests(): void {
	for (const entry of pairingQueue) {
		clearTimeout(entry.timer);
	}
	pairingQueue.length = 0;
	pendingAdmits.clear();
	readySessions.clear();
	limiter.reset();
	nowOverride = null;
}
