import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseCiphertext, parsePublicKey } from '$lib/server/parse';
import { sendCiphertext } from '$lib/server/relay';

export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json().catch(() => ({}))) as {
		from?: string;
		to?: string;
		ciphertext?: string;
	};
	const from = parsePublicKey(body.from ?? null);
	const to = parsePublicKey(body.to ?? null);
	const ciphertext = parseCiphertext(body.ciphertext);
	if (!sendCiphertext(from, to, ciphertext)) {
		error(409, 'peer is not ready');
	}
	return json({ ok: true });
};
