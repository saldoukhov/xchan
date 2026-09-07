import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { bytesToBase64 } from '$lib/crypto/bytes';
import {
	JOIN_MAX,
	JOIN_MAX_UNKNOWN,
	JOIN_WINDOW_MS,
	MAX_QUEUE,
	MATCH_WINDOW_MS
} from './pair-limit';
import {
	admitPairing,
	cancelPairing,
	joinPairing,
	resetRelayForTests,
	setRelayNowForTests
} from './relay';
import type { SseSink } from './sse';

function pub(n: number): string {
	const raw = new Uint8Array(65);
	raw[0] = 0x04;
	raw[1] = n;
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

function pair(a: number, b: number, ipA: string, ipB = ipA): void {
	joinPairing(pub(a), 'A', ipA, sink());
	joinPairing(pub(b), 'B', ipB, sink());
}

beforeEach(() => {
	resetRelayForTests();
	setRelayNowForTests(1_000_000);
});

afterEach(() => {
	resetRelayForTests();
});

describe('pairing', () => {
	it('matches two waiters FIFO and exchanges peer metadata', () => {
		const left = sink();
		const right = sink();
		joinPairing(pub(1), 'MacBook', '192.0.2.10', left);
		joinPairing(pub(2), 'Pixel', '192.0.2.20', right);
		expect(left.events).toContainEqual({
			type: 'paired',
			peerPublicKey: pub(2),
			peerName: 'Pixel',
			peerIp: '192.0.2.20'
		});
		expect(right.events).toContainEqual({
			type: 'paired',
			peerPublicKey: pub(1),
			peerName: 'MacBook',
			peerIp: '192.0.2.10'
		});
	});
});

describe('admitPairing', () => {
	it('allows a reconnect of the same public key without charging a join', () => {
		expect(admitPairing(pub(1), '192.0.2.1').ok).toBe(true);
		expect(admitPairing(pub(1), '192.0.2.1').ok).toBe(true);
		joinPairing(pub(1), 'A', '192.0.2.1', sink());
		cancelPairing(pub(1));
		for (let i = 2; i <= JOIN_MAX; i += 1) {
			expect(admitPairing(pub(i), '192.0.2.1').ok).toBe(true);
			joinPairing(pub(i), 'A', '192.0.2.1', sink());
			cancelPairing(pub(i));
		}
		const blocked = admitPairing(pub(9), '192.0.2.1');
		expect(blocked).toMatchObject({ ok: false, status: 429 });
		expect(blocked.ok === false && blocked.message).toContain('Too many pairing attempts');
	});

	it('rejects a fifth join from the same IP inside a minute', () => {
		for (let i = 1; i <= JOIN_MAX; i += 1) {
			expect(admitPairing(pub(i), '192.0.2.1').ok).toBe(true);
			joinPairing(pub(i), 'A', '192.0.2.1', sink());
			cancelPairing(pub(i));
		}
		expect(admitPairing(pub(8), '192.0.2.1')).toMatchObject({ ok: false, status: 429 });
		setRelayNowForTests(1_000_000 + JOIN_WINDOW_MS + 1);
		expect(admitPairing(pub(8), '192.0.2.1').ok).toBe(true);
	});

	it('rejects a third concurrent waiter from the same IP', () => {
		expect(admitPairing(pub(1), '192.0.2.1').ok).toBe(true);
		expect(admitPairing(pub(2), '192.0.2.1').ok).toBe(true);
		expect(admitPairing(pub(3), '192.0.2.1')).toMatchObject({ ok: false, status: 429 });
	});

	it('charges one match token for a same-IP pair', () => {
		pair(1, 2, '192.0.2.1');
		expect(admitPairing(pub(3), '192.0.2.1').ok).toBe(true);
		pair(3, 4, '192.0.2.1');
		const blocked = admitPairing(pub(5), '192.0.2.1');
		expect(blocked).toMatchObject({ ok: false, status: 429 });
		expect(blocked.ok === false && blocked.message).toContain('Too many recent pairings');
		setRelayNowForTests(1_000_000 + MATCH_WINDOW_MS + 1);
		expect(admitPairing(pub(5), '192.0.2.1').ok).toBe(true);
	});

	it('tracks match budgets independently per IP', () => {
		pair(1, 2, '192.0.2.1', '198.51.100.1');
		pair(3, 4, '192.0.2.1', '198.51.100.2');
		expect(admitPairing(pub(5), '192.0.2.1')).toMatchObject({ ok: false, status: 429 });
		expect(admitPairing(pub(6), '198.51.100.9').ok).toBe(true);
	});

	it('treats IPv6 addresses in the same /64 as one key', () => {
		expect(admitPairing(pub(1), '2001:db8:1:2::1').ok).toBe(true);
		expect(admitPairing(pub(2), '2001:db8:1:2::ffff').ok).toBe(true);
		expect(admitPairing(pub(3), '2001:db8:1:2::3')).toMatchObject({ ok: false, status: 429 });
		expect(admitPairing(pub(4), '2001:db8:1:3::1').ok).toBe(true);
	});

	it('uses a stricter join cap for unknown IPs', () => {
		for (let i = 1; i <= JOIN_MAX_UNKNOWN; i += 1) {
			expect(admitPairing(pub(i), '').ok).toBe(true);
			joinPairing(pub(i), 'A', '', sink());
			cancelPairing(pub(i));
		}
		expect(admitPairing(pub(9), '')).toMatchObject({ ok: false, status: 429 });
	});

	it('rejects a second successful pairing from an unknown IP', () => {
		pair(1, 2, '');
		expect(admitPairing(pub(3), '')).toMatchObject({ ok: false, status: 429 });
	});

	it('rejects a new join when the global queue is full', () => {
		for (let i = 1; i <= MAX_QUEUE; i += 1) {
			expect(admitPairing(pub(i), `198.51.100.${i}`).ok).toBe(true);
		}
		expect(admitPairing(pub(20), '203.0.113.1')).toMatchObject({
			ok: false,
			status: 503
		});
	});

	it('rejects a new join after four matches in a minute', () => {
		for (let i = 0; i < 4; i += 1) {
			const a = i * 2 + 1;
			pair(a, a + 1, `203.0.113.${a}`, `203.0.113.${a + 1}`);
		}
		expect(admitPairing(pub(20), '192.0.2.99')).toMatchObject({ ok: false, status: 429 });
	});
});
