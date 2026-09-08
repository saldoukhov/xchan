import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { whatsNewPayload } from '$lib/releases';

export const GET: RequestHandler = () => {
	return json(whatsNewPayload(), {
		headers: { 'Cache-Control': 'no-store' }
	});
};
