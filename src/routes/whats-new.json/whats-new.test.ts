import { describe, expect, it } from 'vitest';
import { whatsNewPayload } from '$lib/releases';
import { GET } from './+server';

describe('GET /whats-new.json', () => {
	it('returns the release list without storing it', async () => {
		const response = await GET({} as Parameters<typeof GET>[0]);
		expect(response.status).toBe(200);
		expect(response.headers.get('Cache-Control')).toBe('no-store');
		expect(await response.json()).toEqual(whatsNewPayload());
	});
});
