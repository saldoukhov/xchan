import type { RequestHandler } from './$types';
import { parseCiphertext, parsePublicKey } from '$lib/server/parse';
import { joinChannel } from '$lib/server/relay';
import { createSse } from '$lib/server/sse';

export const GET: RequestHandler = ({ url, request }) => {
	const self = parsePublicKey(url.searchParams.get('self'));
	const peer = parsePublicKey(url.searchParams.get('peer'));
	const nameCiphertext = parseCiphertext(url.searchParams.get('nameCiphertext'));
	return createSse(request, (sink) => joinChannel(self, peer, nameCiphertext, sink));
};
