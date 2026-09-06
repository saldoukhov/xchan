import type { RequestHandler } from './$types';
import { parsePublicKey, sanitizeName } from '$lib/server/parse';
import { joinPairing } from '$lib/server/relay';
import { createSse } from '$lib/server/sse';

export const GET: RequestHandler = ({ url, request, getClientAddress }) => {
	const publicKey = parsePublicKey(url.searchParams.get('publicKey'));
	const name = sanitizeName(url.searchParams.get('name'));
	let ip = '';
	try {
		ip = getClientAddress();
	} catch {
		ip = '';
	}
	return createSse(request, (sink) => joinPairing(publicKey, name, ip, sink));
};
