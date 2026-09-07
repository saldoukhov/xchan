import { describe, expect, it } from 'vitest';
import {
	JOIN_MAX,
	JOIN_WINDOW_MS,
	MATCH_MAX,
	MATCH_WINDOW_MS,
	PairLimiter,
	pairingLimitKey
} from './pair-limit';

describe('pairingLimitKey', () => {
	it('uses the full IPv4 address', () => {
		expect(pairingLimitKey('192.0.2.1')).toBe('192.0.2.1');
	});

	it('keys IPv6 by /64', () => {
		expect(pairingLimitKey('2001:db8:1:2:3:4:5:6')).toBe('2001:0db8:0001:0002/64');
		expect(pairingLimitKey('2001:db8:1:2::1')).toBe('2001:0db8:0001:0002/64');
		expect(pairingLimitKey('2001:db8:1:3::1')).toBe('2001:0db8:0001:0003/64');
	});

	it('treats IPv4-mapped IPv6 as IPv4', () => {
		expect(pairingLimitKey('::ffff:192.0.2.1')).toBe('192.0.2.1');
		expect(pairingLimitKey('0:0:0:0:0:ffff:c000:201')).toBe('192.0.2.1');
	});

	it('buckets missing or garbage addresses as unknown', () => {
		expect(pairingLimitKey('')).toBe('unknown');
		expect(pairingLimitKey('   ')).toBe('unknown');
		expect(pairingLimitKey('not-an-ip')).toBe('unknown');
	});
});

describe('PairLimiter', () => {
	it('rejects a fifth join inside the window and recovers after it', () => {
		const limiter = new PairLimiter();
		const key = '192.0.2.1';
		const start = 1_000_000;
		for (let i = 0; i < JOIN_MAX; i += 1) {
			expect(limiter.joinRetryAfter(key, start + i)).toBeNull();
			limiter.recordJoin(key, start + i);
		}
		expect(limiter.joinRetryAfter(key, start + JOIN_MAX)).toBeGreaterThan(0);
		expect(limiter.joinRetryAfter(key, start + JOIN_WINDOW_MS + 1)).toBeNull();
	});

	it('rejects a third match inside the window', () => {
		const limiter = new PairLimiter();
		const key = '192.0.2.1';
		const start = 1_000_000;
		limiter.recordMatch(key, start);
		limiter.recordMatch(key, start + 1);
		expect(limiter.matchRetryAfter(key, start + 2)).toBeGreaterThan(0);
		expect(limiter.matchRetryAfter(key, start + MATCH_WINDOW_MS + 1)).toBeNull();
		expect(MATCH_MAX).toBe(2);
	});

	it('uses a stricter unknown-IP join cap', () => {
		const limiter = new PairLimiter();
		limiter.recordJoin('unknown', 1_000_000);
		limiter.recordJoin('unknown', 1_000_001);
		expect(limiter.joinRetryAfter('unknown', 1_000_002)).toBeGreaterThan(0);
		expect(limiter.joinRetryAfter('192.0.2.1', 1_000_002)).toBeNull();
	});
});
