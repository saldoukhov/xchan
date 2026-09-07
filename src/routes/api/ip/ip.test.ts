import { describe, expect, it } from 'vitest';
import type { RequestHandler } from './$types';
import { GET } from './+server';

function event(ip: string | (() => string)): Parameters<RequestHandler>[0] {
	return {
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
