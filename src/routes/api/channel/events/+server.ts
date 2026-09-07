import type { RequestHandler } from './$types';
import { parsePublicKey, sanitizeName } from '$lib/server/parse';
import { joinChannel } from '$lib/server/relay';
import { createSse } from '$lib/server/sse';

export const GET: RequestHandler = ({ url, request }) => {
	const self = parsePublicKey(url.searchParams.get('self'));
	const peer = parsePublicKey(url.searchParams.get('peer'));
	const name = sanitizeName(url.searchParams.get('name'));
	return createSse(request, (sink) => joinChannel(self, peer, name, sink));
};
