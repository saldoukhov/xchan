import { commitOfPairing } from '$lib/crypto/hash';
import { MAX_CIPHERTEXT_BYTES } from '$lib/payload';
import { PAIRING_MS } from '$lib/pairing';
import {
	CROSS_NETWORK_GRACE_MS,
	MAX_CONCURRENT_PER_IP,
	MAX_QUEUE,
	PairLimiter,
	PENDING_ADMIT_MS,
	pairingLimitKey,
	sameKnownPairingNetwork
} from './pair-limit';
import type { SseSink } from './sse';

export { PAIRING_MS, MAX_CIPHERTEXT_BYTES };

export type PairingAdmission =
	{ ok: true } | { ok: false; status: 429 | 503; retryAfterSec: number; message: string };

type PairingEntry = {
	commit: string;
	publicKey: string | null;
	identityPublicKey: string;
	ip: string;
	sink: SseSink;
	joinedAt: number;
	timer: ReturnType<typeof setTimeout>;
	graceTimer: ReturnType<typeof setTimeout> | undefined;
	peer: PairingEntry | null;
};

export type RevealResult = 'ok' | 'unknown' | 'mismatch' | 'too_early';

type ReadySession = {
	self: string;
	peer: string;
	nameCiphertext: string;
	ip: string;
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

function clearPairingTimers(entry: PairingEntry): void {
	clearTimeout(entry.timer);
	if (entry.graceTimer) clearTimeout(entry.graceTimer);
}

function removePairing(commit: string, reason: 'timeout' | 'cancelled'): boolean {
	const index = pairingQueue.findIndex((entry) => entry.commit === commit);
	if (index === -1) return false;
	const [entry] = pairingQueue.splice(index, 1);
	clearPairingTimers(entry);
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
	if (!sameKnownPairingNetwork(a.ip, b.ip)) {
		const keys = new Set([pairingLimitKey(a.ip), pairingLimitKey(b.ip)]);
		for (const key of keys) {
			limiter.recordMatch(key, at);
		}
	}
	limiter.recordGlobalMatch(at);
}

function canPair(a: PairingEntry, b: PairingEntry): boolean {
	return a.commit !== b.commit && a.identityPublicKey !== b.identityPublicKey;
}

function findMatch(unmatched: PairingEntry[]): { a: PairingEntry; b: PairingEntry } | null {
	for (const a of unmatched) {
		const b = unmatched.find(
			(entry) => canPair(a, entry) && sameKnownPairingNetwork(a.ip, entry.ip)
		);
		if (b) return { a, b };
	}
	const at = now();
	const ready = unmatched.filter((entry) => at - entry.joinedAt >= CROSS_NETWORK_GRACE_MS);
	if (ready.length < 2) return null;
	const a = ready[0];
	const b = ready.find((entry) => canPair(a, entry));
	return b ? { a, b } : null;
}

function tryMatch(): void {
	for (;;) {
		const unmatched = pairingQueue.filter((entry) => !entry.peer);
		const pair = findMatch(unmatched);
		if (!pair) return;
		pair.a.peer = pair.b;
		pair.b.peer = pair.a;
		pair.a.sink.send({ type: 'reveal', peerCommit: pair.b.commit });
		pair.b.sink.send({ type: 'reveal', peerCommit: pair.a.commit });
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
	clearPairingTimers(aEntry);
	clearPairingTimers(bEntry);
	aEntry.sink.send({
		type: 'paired',
		peerPublicKey: bEntry.publicKey,
		peerIdentityPublicKey: bEntry.identityPublicKey,
		peerIp: bEntry.ip
	});
	bEntry.sink.send({
		type: 'paired',
		peerPublicKey: aEntry.publicKey,
		peerIdentityPublicKey: aEntry.identityPublicKey,
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
	clearPairingTimers(aEntry);
	clearPairingTimers(bEntry);
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
		ip,
		sink,
		peer: null,
		joinedAt: now(),
		timer: setTimeout(() => {
			removePairing(commit, 'timeout');
		}, PAIRING_MS),
		graceTimer:
			nowOverride === null
				? setTimeout(() => {
						tryMatch();
					}, CROSS_NETWORK_GRACE_MS)
				: undefined
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

function statusEvent(
	ready: boolean,
	exchange?: { nameCiphertext: string; peerIp: string; selfIp: string }
): {
	type: 'status';
	ready: boolean;
	peerNameCiphertext: string | undefined;
	peerIp?: string;
	selfIp?: string;
} {
	if (!ready || !exchange) {
		return { type: 'status', ready: false, peerNameCiphertext: undefined };
	}
	return {
		type: 'status',
		ready: true,
		peerNameCiphertext: exchange.nameCiphertext,
		peerIp: exchange.peerIp,
		selfIp: exchange.selfIp
	};
}

function notifyPeerStatus(self: string, peer: string, ready: boolean): void {
	const inverse = readySessions.get(peer);
	const joiner = readySessions.get(self);
	if (inverse && inverse.peer === self) {
		inverse.sink.send(
			ready && joiner
				? statusEvent(true, {
						nameCiphertext: joiner.nameCiphertext,
						peerIp: joiner.ip,
						selfIp: inverse.ip
					})
				: statusEvent(false)
		);
	}
}

export function joinChannel(
	self: string,
	peer: string,
	nameCiphertext: string,
	ip: string,
	sink: SseSink
): () => void {
	const previous = readySessions.get(self);
	if (previous) {
		previous.sink.close();
	}
	readySessions.set(self, { self, peer, nameCiphertext, ip, sink });
	const inverse = readySessions.get(peer);
	const ready = Boolean(inverse && inverse.peer === self);
	sink.send(
		ready && inverse
			? statusEvent(true, {
					nameCiphertext: inverse.nameCiphertext,
					peerIp: inverse.ip,
					selfIp: ip
				})
			: statusEvent(false)
	);
	if (ready) {
		notifyPeerStatus(self, peer, true);
	}
	return () => {
		const current = readySessions.get(self);
		if (current?.sink === sink) {
			readySessions.delete(self);
			notifyPeerStatus(self, peer, false);
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
	if (ms !== null) tryMatch();
}

export function resetRelayForTests(): void {
	for (const entry of pairingQueue) {
		clearPairingTimers(entry);
	}
	pairingQueue.length = 0;
	pendingAdmits.clear();
	readySessions.clear();
	limiter.reset();
	nowOverride = null;
}
