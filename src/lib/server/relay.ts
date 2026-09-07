import {
	MAX_CONCURRENT_PER_IP,
	MAX_QUEUE,
	PairLimiter,
	PENDING_ADMIT_MS,
	pairingLimitKey
} from './pair-limit';
import type { SseSink } from './sse';

export const PAIRING_MS = 30_000;
export const MAX_CIPHERTEXT_BYTES = 64 * 1024;
export const MAX_NAME_CHARS = 64;

export type PairingAdmission =
	{ ok: true } | { ok: false; status: 429 | 503; retryAfterSec: number; message: string };

type PairingEntry = {
	publicKey: string;
	name: string;
	ip: string;
	sink: SseSink;
	timer: ReturnType<typeof setTimeout>;
};

type ReadySession = {
	self: string;
	peer: string;
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

function waiterSnapshots(at: number): { publicKey: string; ip: string }[] {
	prunePending(at);
	const byKey = new Map<string, string>();
	for (const entry of pairingQueue) {
		byKey.set(entry.publicKey, entry.ip);
	}
	for (const [publicKey, pending] of pendingAdmits) {
		if (!byKey.has(publicKey)) byKey.set(publicKey, pending.ip);
	}
	return [...byKey].map(([publicKey, ip]) => ({ publicKey, ip }));
}

export function admitPairing(publicKey: string, ip: string): PairingAdmission {
	const at = now();
	const waiters = waiterSnapshots(at);
	if (waiters.some((waiter) => waiter.publicKey === publicKey)) {
		const pending = pendingAdmits.get(publicKey);
		if (pending) {
			pendingAdmits.set(publicKey, { ip, expiresAt: at + PENDING_ADMIT_MS });
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
	pendingAdmits.set(publicKey, { ip, expiresAt: at + PENDING_ADMIT_MS });
	return { ok: true };
}

function removePairing(publicKey: string, reason: 'timeout' | 'cancelled'): boolean {
	const index = pairingQueue.findIndex((entry) => entry.publicKey === publicKey);
	if (index === -1) return false;
	const [entry] = pairingQueue.splice(index, 1);
	clearTimeout(entry.timer);
	entry.sink.send({ type: reason });
	entry.sink.close();
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
	while (pairingQueue.length >= 2) {
		const aEntry = pairingQueue.shift()!;
		const bIndex = pairingQueue.findIndex((entry) => entry.publicKey !== aEntry.publicKey);
		if (bIndex === -1) {
			pairingQueue.unshift(aEntry);
			return;
		}
		const [bEntry] = pairingQueue.splice(bIndex, 1);
		clearTimeout(aEntry.timer);
		clearTimeout(bEntry.timer);
		recordPairMatch(aEntry, bEntry);
		aEntry.sink.send({
			type: 'paired',
			peerPublicKey: bEntry.publicKey,
			peerName: bEntry.name,
			peerIp: bEntry.ip
		});
		bEntry.sink.send({
			type: 'paired',
			peerPublicKey: aEntry.publicKey,
			peerName: aEntry.name,
			peerIp: aEntry.ip
		});
		queueMicrotask(() => {
			aEntry.sink.close();
			bEntry.sink.close();
		});
	}
}

export function joinPairing(
	publicKey: string,
	name: string,
	ip: string,
	sink: SseSink
): () => void {
	const alreadyWaiting =
		pendingAdmits.has(publicKey) || pairingQueue.some((entry) => entry.publicKey === publicKey);
	if (!alreadyWaiting) {
		const admitted = admitPairing(publicKey, ip);
		if (!admitted.ok) {
			throw new PairingRejected(admitted);
		}
	}
	pendingAdmits.delete(publicKey);
	removePairing(publicKey, 'cancelled');
	const entry: PairingEntry = {
		publicKey,
		name,
		ip,
		sink,
		timer: setTimeout(() => {
			removePairing(publicKey, 'timeout');
		}, PAIRING_MS)
	};
	pairingQueue.push(entry);
	sink.send({ type: 'waiting' });
	tryMatch();
	return () => {
		removePairing(publicKey, 'cancelled');
	};
}

export class PairingRejected extends Error {
	readonly admission: Extract<PairingAdmission, { ok: false }>;

	constructor(admission: Extract<PairingAdmission, { ok: false }>) {
		super(admission.message);
		this.name = 'PairingRejected';
		this.admission = admission;
	}
}

export function cancelPairing(publicKey: string): boolean {
	return removePairing(publicKey, 'cancelled');
}

function notifyPeerStatus(self: string, peer: string, ready: boolean): void {
	const inverse = readySessions.get(peer);
	if (inverse && inverse.peer === self) {
		inverse.sink.send({ type: 'status', ready });
	}
}

export function joinChannel(self: string, peer: string, sink: SseSink): () => void {
	const previous = readySessions.get(self);
	if (previous) {
		previous.sink.close();
	}
	readySessions.set(self, { self, peer, sink });
	const inverse = readySessions.get(peer);
	const ready = Boolean(inverse && inverse.peer === self);
	sink.send({ type: 'status', ready });
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
