import type { SseSink } from './sse';

export const PAIRING_MS = 30_000;
export const MAX_CIPHERTEXT_BYTES = 64 * 1024;
export const MAX_NAME_CHARS = 64;

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

const pairingQueue: PairingEntry[] = [];
const readySessions = new Map<string, ReadySession>();

function removePairing(publicKey: string, reason: 'timeout' | 'cancelled'): boolean {
	const index = pairingQueue.findIndex((entry) => entry.publicKey === publicKey);
	if (index === -1) return false;
	const [entry] = pairingQueue.splice(index, 1);
	clearTimeout(entry.timer);
	entry.sink.send({ type: reason });
	entry.sink.close();
	return true;
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
