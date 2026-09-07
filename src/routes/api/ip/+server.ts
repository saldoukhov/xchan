import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readClientIp } from '$lib/server/client-ip';

export const GET: RequestHandler = ({ getClientAddress }) => {
	return json({ ip: readClientIp(getClientAddress) }, { headers: { 'Cache-Control': 'no-store' } });
};
