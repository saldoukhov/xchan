import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { bytesToBase64 } from '$lib/crypto/bytes';
import { commitOfPairing } from '$lib/crypto/hash';
import {
	CROSS_NETWORK_GRACE_MS,
	JOIN_MAX,
	JOIN_MAX_UNKNOWN,
	JOIN_WINDOW_MS,
	MAX_CONCURRENT_PER_IP,
	MAX_QUEUE,
	sameKnownPairingNetwork
} from './pair-limit';
import {
	admitPairing,
	cancelPairing,
	joinChannel,
	joinPairing,
	resetRelayForTests,
	revealPairing,
	setRelayNowForTests
} from './relay';
import type { SseSink } from './sse';

function pub(n: number): string {
	const raw = new Uint8Array(65);
	raw[0] = 0x04;
	raw[1] = n;
	return bytesToBase64(raw);
}

function commitId(n: number): string {
	const raw = new Uint8Array(32);
	raw[0] = n;
	return bytesToBase64(raw);
}

function sink(): SseSink & { events: unknown[] } {
	const events: unknown[] = [];
	return {
		events,
		send(data) {
			events.push(data);
		},
		close() {
			events.push('closed');
		}
	};
}

function idPub(n: number): string {
	return pub(n + 100);
}

let relayNow = 1_000_000;

function advanceRelay(ms: number): void {
	relayNow += ms;
	setRelayNowForTests(relayNow);
}

async function pair(a: number, b: number, ipA: string, ipB = ipA): Promise<void> {
	const commitA = await commitOfPairing(pub(a), idPub(a));
	const commitB = await commitOfPairing(pub(b), idPub(b));
	joinPairing(commitA, idPub(a), ipA, sink());
	joinPairing(commitB, idPub(b), ipB, sink());
	if (!sameKnownPairingNetwork(ipA, ipB)) advanceRelay(CROSS_NETWORK_GRACE_MS);
	expect(await revealPairing(commitA, pub(a), idPub(a))).toBe('ok');
	expect(await revealPairing(commitB, pub(b), idPub(b))).toBe('ok');
}

beforeEach(() => {
	resetRelayForTests();
	relayNow = 1_000_000;
	setRelayNowForTests(relayNow);
});

afterEach(() => {
	resetRelayForTests();
});

describe('pairing', () => {
	it('matches two waiters with commit-reveal before exchanging keys', async () => {
		const left = sink();
		const right = sink();
		const commitA = await commitOfPairing(pub(1), idPub(1));
		const commitB = await commitOfPairing(pub(2), idPub(2));
		joinPairing(commitA, idPub(1), '192.0.2.10', left);
		joinPairing(commitB, idPub(2), '192.0.2.20', right);
		advanceRelay(CROSS_NETWORK_GRACE_MS);
		expect(left.events).toContainEqual({ type: 'reveal', peerCommit: commitB });
		expect(right.events).toContainEqual({ type: 'reveal', peerCommit: commitA });
		expect(left.events.some((event) => (event as { type?: string }).type === 'paired')).toBe(false);
		expect(await revealPairing(commitA, pub(1), idPub(1))).toBe('ok');
		expect(left.events.some((event) => (event as { type?: string }).type === 'paired')).toBe(false);
		expect(await revealPairing(commitB, pub(2), idPub(2))).toBe('ok');
		expect(left.events).toContainEqual({
			type: 'paired',
			peerPublicKey: pub(2),
			peerIdentityPublicKey: idPub(2),
			peerIp: '192.0.2.20'
		});
		expect(right.events).toContainEqual({
			type: 'paired',
			peerPublicKey: pub(1),
			peerIdentityPublicKey: idPub(1),
			peerIp: '192.0.2.10'
		});
	});

	it('rejects a reveal that does not match the commit', async () => {
		const commitA = await commitOfPairing(pub(1), idPub(1));
		const commitB = await commitOfPairing(pub(2), idPub(2));
		joinPairing(commitA, idPub(1), '192.0.2.10', sink());
		joinPairing(commitB, idPub(2), '192.0.2.20', sink());
		advanceRelay(CROSS_NETWORK_GRACE_MS);
		expect(await revealPairing(commitA, pub(2), idPub(1))).toBe('mismatch');
	});

	it('cancels the peer if one side drops after reveal is requested', async () => {
		const left = sink();
		const right = sink();
		const commitA = await commitOfPairing(pub(1), idPub(1));
		const commitB = await commitOfPairing(pub(2), idPub(2));
		joinPairing(commitA, idPub(1), '192.0.2.10', left);
		joinPairing(commitB, idPub(2), '192.0.2.20', right);
		advanceRelay(CROSS_NETWORK_GRACE_MS);
		cancelPairing(commitA);
		expect(right.events).toContainEqual({ type: 'cancelled' });
	});

	it('does not match two waiters from the same device identity', async () => {
		const left = sink();
		const right = sink();
		const extra = sink();
		const commitA = await commitOfPairing(pub(1), idPub(1));
		const commitB = await commitOfPairing(pub(2), idPub(1));
		const commitC = await commitOfPairing(pub(3), idPub(3));
		joinPairing(commitA, idPub(1), '192.0.2.10', left);
		joinPairing(commitB, idPub(1), '192.0.2.10', right);
		expect(left.events.some((event) => (event as { type?: string }).type === 'reveal')).toBe(false);
		expect(right.events.some((event) => (event as { type?: string }).type === 'reveal')).toBe(
			false
		);
		joinPairing(commitC, idPub(3), '198.51.100.1', extra);
		advanceRelay(CROSS_NETWORK_GRACE_MS);
		expect(left.events).toContainEqual({ type: 'reveal', peerCommit: commitC });
		expect(extra.events).toContainEqual({ type: 'reveal', peerCommit: commitA });
		expect(right.events.some((event) => (event as { type?: string }).type === 'reveal')).toBe(
			false
		);
	});

	it('matches two waiters on the same network before a stranger already in the queue', async () => {
		const stranger = sink();
		const left = sink();
		const right = sink();
		const commitS = await commitOfPairing(pub(1), idPub(1));
		const commitA = await commitOfPairing(pub(2), idPub(2));
		const commitB = await commitOfPairing(pub(3), idPub(3));
		joinPairing(commitS, idPub(1), '198.51.100.9', stranger);
		joinPairing(commitA, idPub(2), '192.0.2.10', left);
		expect(left.events.some((event) => (event as { type?: string }).type === 'reveal')).toBe(false);
		joinPairing(commitB, idPub(3), '192.0.2.10', right);
		expect(left.events).toContainEqual({ type: 'reveal', peerCommit: commitB });
		expect(right.events).toContainEqual({ type: 'reveal', peerCommit: commitA });
		expect(stranger.events.some((event) => (event as { type?: string }).type === 'reveal')).toBe(
			false
		);
	});

	it('matches two waiters in the same IPv6 /64 before a stranger', async () => {
		const stranger = sink();
		const left = sink();
		const right = sink();
		const commitS = await commitOfPairing(pub(1), idPub(1));
		const commitA = await commitOfPairing(pub(2), idPub(2));
		const commitB = await commitOfPairing(pub(3), idPub(3));
		joinPairing(commitS, idPub(1), '198.51.100.9', stranger);
		joinPairing(commitA, idPub(2), '2001:db8:1:2::1', left);
		expect(left.events.some((event) => (event as { type?: string }).type === 'reveal')).toBe(false);
		joinPairing(commitB, idPub(3), '2001:db8:1:2::ffff', right);
		expect(left.events).toContainEqual({ type: 'reveal', peerCommit: commitB });
		expect(right.events).toContainEqual({ type: 'reveal', peerCommit: commitA });
		expect(stranger.events.some((event) => (event as { type?: string }).type === 'reveal')).toBe(
			false
		);
	});

	it('does not treat unknown IPs as the same network when matching', async () => {
		const stranger = sink();
		const left = sink();
		const right = sink();
		const commitS = await commitOfPairing(pub(1), idPub(1));
		const commitA = await commitOfPairing(pub(2), idPub(2));
		const commitB = await commitOfPairing(pub(3), idPub(3));
		joinPairing(commitS, idPub(1), '198.51.100.9', stranger);
		joinPairing(commitA, idPub(2), '', left);
		joinPairing(commitB, idPub(3), '', right);
		advanceRelay(CROSS_NETWORK_GRACE_MS);
		expect(stranger.events).toContainEqual({ type: 'reveal', peerCommit: commitA });
		expect(left.events).toContainEqual({ type: 'reveal', peerCommit: commitS });
		expect(right.events.some((event) => (event as { type?: string }).type === 'reveal')).toBe(
			false
		);
	});

	it('FIFO-matches different networks only after the grace period', async () => {
		const left = sink();
		const right = sink();
		const commitA = await commitOfPairing(pub(1), idPub(1));
		const commitB = await commitOfPairing(pub(2), idPub(2));
		joinPairing(commitA, idPub(1), '192.0.2.10', left);
		joinPairing(commitB, idPub(2), '192.0.2.20', right);
		expect(left.events.some((event) => (event as { type?: string }).type === 'reveal')).toBe(false);
		advanceRelay(CROSS_NETWORK_GRACE_MS - 1);
		expect(left.events.some((event) => (event as { type?: string }).type === 'reveal')).toBe(false);
		advanceRelay(1);
		expect(left.events).toContainEqual({ type: 'reveal', peerCommit: commitB });
		expect(right.events).toContainEqual({ type: 'reveal', peerCommit: commitA });
	});
});

describe('admitPairing', () => {
	it('allows a reconnect of the same public key without charging a join', () => {
		expect(admitPairing(commitId(1), '192.0.2.1').ok).toBe(true);
		expect(admitPairing(commitId(1), '192.0.2.1').ok).toBe(true);
		joinPairing(commitId(1), pub(1), '192.0.2.1', sink());
		cancelPairing(commitId(1));
		for (let i = 2; i <= JOIN_MAX; i += 1) {
			expect(admitPairing(commitId(i), '192.0.2.1').ok).toBe(true);
			joinPairing(commitId(i), pub(i), '192.0.2.1', sink());
			cancelPairing(commitId(i));
		}
		const blocked = admitPairing(commitId(9), '192.0.2.1');
		expect(blocked).toMatchObject({ ok: false, status: 429 });
		expect(blocked.ok === false && blocked.message).toContain('Too many pairing attempts');
	});

	it('rejects a fifth join from the same IP inside a minute', () => {
		for (let i = 1; i <= JOIN_MAX; i += 1) {
			expect(admitPairing(commitId(i), '192.0.2.1').ok).toBe(true);
			joinPairing(commitId(i), pub(i), '192.0.2.1', sink());
			cancelPairing(commitId(i));
		}
		expect(admitPairing(commitId(8), '192.0.2.1')).toMatchObject({ ok: false, status: 429 });
		setRelayNowForTests(1_000_000 + JOIN_WINDOW_MS + 1);
		expect(admitPairing(commitId(8), '192.0.2.1').ok).toBe(true);
	});

	it('rejects a fifth concurrent waiter from the same IP', () => {
		for (let i = 1; i <= MAX_CONCURRENT_PER_IP; i += 1) {
			expect(admitPairing(commitId(i), '192.0.2.1').ok).toBe(true);
		}
		expect(admitPairing(commitId(MAX_CONCURRENT_PER_IP + 1), '192.0.2.1')).toMatchObject({
			ok: false,
			status: 429
		});
	});

	it('does not spend per-IP match budget on a same-network pair', async () => {
		await pair(1, 2, '192.0.2.1');
		await pair(3, 4, '192.0.2.1');
		setRelayNowForTests(1_000_000 + JOIN_WINDOW_MS + 1);
		expect(admitPairing(await commitOfPairing(pub(5), idPub(5)), '192.0.2.1').ok).toBe(true);
	});

	it('tracks match budgets independently per IP', async () => {
		await pair(1, 2, '192.0.2.1', '198.51.100.1');
		await pair(3, 4, '192.0.2.1', '198.51.100.2');
		expect(admitPairing(commitId(5), '192.0.2.1')).toMatchObject({ ok: false, status: 429 });
		expect(admitPairing(commitId(6), '198.51.100.9').ok).toBe(true);
	});

	it('treats IPv6 addresses in the same /64 as one key', () => {
		for (let i = 1; i <= MAX_CONCURRENT_PER_IP; i += 1) {
			expect(admitPairing(commitId(i), `2001:db8:1:2::${i.toString(16)}`).ok).toBe(true);
		}
		expect(admitPairing(commitId(9), '2001:db8:1:2::ffff')).toMatchObject({
			ok: false,
			status: 429
		});
		expect(admitPairing(commitId(10), '2001:db8:1:3::1').ok).toBe(true);
	});

	it('uses a stricter join cap for unknown IPs', () => {
		for (let i = 1; i <= JOIN_MAX_UNKNOWN; i += 1) {
			expect(admitPairing(commitId(i), '').ok).toBe(true);
			joinPairing(commitId(i), pub(i), '', sink());
			cancelPairing(commitId(i));
		}
		expect(admitPairing(commitId(9), '')).toMatchObject({ ok: false, status: 429 });
	});

	it('rejects a second successful pairing from an unknown IP', async () => {
		await pair(1, 2, '');
		setRelayNowForTests(1_000_000 + JOIN_WINDOW_MS + 1);
		const blocked = admitPairing(commitId(3), '');
		expect(blocked).toMatchObject({ ok: false, status: 429 });
		expect(blocked.ok === false && blocked.message).toContain('Too many recent pairings');
	});

	it('rejects a new join when the global queue is full', () => {
		for (let i = 1; i <= MAX_QUEUE; i += 1) {
			expect(admitPairing(commitId(i), `198.51.100.${i}`).ok).toBe(true);
		}
		expect(admitPairing(commitId(20), '203.0.113.1')).toMatchObject({
			ok: false,
			status: 503
		});
	});

	it('rejects a new join after four matches in a minute', async () => {
		for (let i = 0; i < 4; i += 1) {
			const a = i * 2 + 1;
			await pair(a, a + 1, `203.0.113.${a}`, `203.0.113.${a + 1}`);
		}
		expect(admitPairing(commitId(20), '192.0.2.99')).toMatchObject({ ok: false, status: 429 });
	});

	it('counts same-network pairs toward the global match cap', async () => {
		for (let i = 0; i < 4; i += 1) {
			const a = i * 2 + 1;
			await pair(a, a + 1, `203.0.113.${a}`);
		}
		expect(admitPairing(commitId(20), '192.0.2.99')).toMatchObject({ ok: false, status: 429 });
	});
});

describe('joinChannel', () => {
	it('exchanges name ciphertext when both peers are ready', () => {
		const left = sink();
		const right = sink();
		joinChannel(pub(1), pub(2), 'ct-MacBook', '192.0.2.10', left);
		expect(left.events).toContainEqual({
			type: 'status',
			ready: false,
			peerNameCiphertext: undefined
		});
		joinChannel(pub(2), pub(1), 'ct-Pixel', '192.0.2.20', right);
		expect(right.events).toContainEqual({
			type: 'status',
			ready: true,
			peerNameCiphertext: 'ct-MacBook',
			peerIp: '192.0.2.10',
			selfIp: '192.0.2.20'
		});
		expect(left.events).toContainEqual({
			type: 'status',
			ready: true,
			peerNameCiphertext: 'ct-Pixel',
			peerIp: '192.0.2.20',
			selfIp: '192.0.2.10'
		});
	});

	it('omits IPs when a peer leaves ready state', () => {
		const left = sink();
		const right = sink();
		const leave = joinChannel(pub(1), pub(2), 'ct-MacBook', '192.0.2.10', left);
		joinChannel(pub(2), pub(1), 'ct-Pixel', '192.0.2.20', right);
		leave();
		expect(right.events.at(-1)).toEqual({
			type: 'status',
			ready: false,
			peerNameCiphertext: undefined
		});
	});
});
