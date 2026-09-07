import { describe, expect, it } from 'vitest';
import { displayClientIp, readClientIp } from './client-ip';

describe('displayClientIp', () => {
	it('returns a trimmed IPv4 address', () => {
		expect(displayClientIp('  192.0.2.10  ')).toBe('192.0.2.10');
	});

	it('unwraps IPv4-mapped IPv6', () => {
		expect(displayClientIp('::ffff:192.0.2.10')).toBe('192.0.2.10');
		expect(displayClientIp('::FFFF:192.0.2.10')).toBe('192.0.2.10');
	});

	it('keeps native IPv6', () => {
		expect(displayClientIp('2001:db8::1')).toBe('2001:db8::1');
	});

	it('returns empty for blank input', () => {
		expect(displayClientIp('')).toBe('');
		expect(displayClientIp('   ')).toBe('');
	});
});

describe('readClientIp', () => {
	it('reads the client address', () => {
		expect(readClientIp(() => '192.0.2.10')).toBe('192.0.2.10');
	});

	it('returns empty when getClientAddress throws', () => {
		expect(
			readClientIp(() => {
				throw new Error('unavailable');
			})
		).toBe('');
	});
});
