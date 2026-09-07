import { describe, expect, it } from 'vitest';
import type { RequestHandler } from './$types';
import { GET } from './+server';

function event(
	ip: string | (() => string),
	headers: HeadersInit = {}
): Parameters<RequestHandler>[0] {
	return {
		request: new Request('http://localhost/api/ip', { headers }),
		getClientAddress: typeof ip === 'function' ? ip : () => ip
	} as Parameters<RequestHandler>[0];
}

describe('GET /api/ip', () => {
	it('returns the client address', async () => {
		const response = await GET(event('192.0.2.10'));
		expect(response.status).toBe(200);
		expect(response.headers.get('Cache-Control')).toBe('no-store');
		expect(await response.json()).toEqual({ ip: '192.0.2.10' });
	});

	it('unwraps IPv4-mapped IPv6', async () => {
		const response = await GET(event('::ffff:192.0.2.10'));
		expect(await response.json()).toEqual({ ip: '192.0.2.10' });
	});

	it('returns the leftmost public X-Forwarded-For address, not the CDN hop', async () => {
		const response = await GET(
			event('79.127.217.65', { 'x-forwarded-for': '73.66.155.165, 79.127.217.65' })
		);
		expect(await response.json()).toEqual({ ip: '73.66.155.165' });
	});

	it('returns an empty ip when the address is unavailable', async () => {
		const response = await GET(
			event(() => {
				throw new Error('unavailable');
			})
		);
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ ip: '' });
	});
});
