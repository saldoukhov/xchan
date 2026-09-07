import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseCommit, parsePublicKey } from '$lib/server/parse';
import { revealPairing } from '$lib/server/relay';

export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json().catch(() => ({}))) as {
		commit?: string;
		publicKey?: string;
		identityPublicKey?: string;
	};
	const commit = parseCommit(body.commit ?? null);
	const publicKey = parsePublicKey(body.publicKey ?? null);
	const identityPublicKey = parsePublicKey(body.identityPublicKey ?? null);
	const result = await revealPairing(commit, publicKey, identityPublicKey);
	if (result === 'unknown' || result === 'too_early') {
		error(404, 'not waiting');
	}
	if (result === 'mismatch') {
		error(400, 'commit mismatch');
	}
	return json({ ok: true });
};
