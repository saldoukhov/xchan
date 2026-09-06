import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parsePublicKey } from '$lib/server/parse';
import { cancelPairing } from '$lib/server/relay';

export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json().catch(() => ({}))) as { publicKey?: string };
	const publicKey = parsePublicKey(body.publicKey ?? null);
	const cancelled = cancelPairing(publicKey);
	return json({ cancelled });
};
