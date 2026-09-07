import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readClientIp } from '$lib/server/client-ip';

export const GET: RequestHandler = ({ getClientAddress, request }) => {
	return json(
		{ ip: readClientIp(getClientAddress, request.headers) },
		{ headers: { 'Cache-Control': 'no-store' } }
	);
};
