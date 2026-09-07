import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseCommit } from '$lib/server/parse';
import { cancelPairing } from '$lib/server/relay';

export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json().catch(() => ({}))) as { commit?: string };
	const commit = parseCommit(body.commit ?? null);
	const cancelled = cancelPairing(commit);
	return json({ cancelled });
};
