import { describe, expect, it } from 'vitest';
import { displayClientIp, forwardedClientIp, isPublicIp, readClientIp } from './client-ip';

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

describe('isPublicIp', () => {
	it('treats documentation and unicast addresses as public', () => {
		expect(isPublicIp('192.0.2.10')).toBe(true);
		expect(isPublicIp('73.66.155.165')).toBe(true);
		expect(isPublicIp('2001:db8::1')).toBe(true);
	});

	it('rejects loopback, RFC1918, link-local, and CGNAT', () => {
		expect(isPublicIp('127.0.0.1')).toBe(false);
		expect(isPublicIp('10.1.2.3')).toBe(false);
		expect(isPublicIp('192.168.0.9')).toBe(false);
		expect(isPublicIp('172.16.1.1')).toBe(false);
		expect(isPublicIp('169.254.1.1')).toBe(false);
		expect(isPublicIp('100.64.0.3')).toBe(false);
		expect(isPublicIp('::1')).toBe(false);
		expect(isPublicIp('fc00::1')).toBe(false);
		expect(isPublicIp('fe80::1')).toBe(false);
	});
});

describe('forwardedClientIp', () => {
	it('takes the leftmost public address in X-Forwarded-For', () => {
		expect(
			forwardedClientIp(
				new Headers({
					'x-forwarded-for': '73.66.155.165, 79.127.217.65'
				})
			)
		).toBe('73.66.155.165');
	});

	it('skips private and CGNAT hops before a public client', () => {
		expect(
			forwardedClientIp(
				new Headers({
					'x-forwarded-for': '100.64.0.3, 73.66.155.165, 79.127.217.65'
				})
			)
		).toBe('73.66.155.165');
	});

	it('strips IPv4 ports and bracketed IPv6', () => {
		expect(
			forwardedClientIp(new Headers({ 'x-forwarded-for': '192.0.2.10:51234, 10.0.0.1' }))
		).toBe('192.0.2.10');
		expect(forwardedClientIp(new Headers({ 'x-forwarded-for': '[2001:db8::1]' }))).toBe(
			'2001:db8::1'
		);
	});

	it('uses Fastly-Client-Ip when X-Forwarded-For has no public address', () => {
		expect(
			forwardedClientIp(
				new Headers({
					'x-forwarded-for': '100.64.0.3',
					'fastly-client-ip': '73.66.155.165'
				})
			)
		).toBe('73.66.155.165');
	});

	it('does not prefer X-Real-IP over a public X-Forwarded-For client', () => {
		expect(
			forwardedClientIp(
				new Headers({
					'x-forwarded-for': '73.66.155.165, 79.127.217.65',
					'x-real-ip': '79.127.217.65'
				})
			)
		).toBe('73.66.155.165');
	});
});

describe('readClientIp', () => {
	it('prefers forwarded headers over getClientAddress', () => {
		expect(
			readClientIp(
				() => '79.127.217.65',
				new Headers({ 'x-forwarded-for': '73.66.155.165, 79.127.217.65' })
			)
		).toBe('73.66.155.165');
	});

	it('falls back to getClientAddress', () => {
		expect(readClientIp(() => '192.0.2.10')).toBe('192.0.2.10');
		expect(readClientIp(() => '192.0.2.10', new Headers())).toBe('192.0.2.10');
	});

	it('returns empty when getClientAddress throws', () => {
		expect(
			readClientIp(() => {
				throw new Error('unavailable');
			})
		).toBe('');
	});
});
