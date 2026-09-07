import type { RequestHandler } from './$types';
import { readClientIp } from '$lib/server/client-ip';
import { parseCiphertext, parsePublicKey } from '$lib/server/parse';
import { joinChannel } from '$lib/server/relay';
import { createSse } from '$lib/server/sse';

export const GET: RequestHandler = ({ url, request, getClientAddress }) => {
	const self = parsePublicKey(url.searchParams.get('self'));
	const peer = parsePublicKey(url.searchParams.get('peer'));
	const nameCiphertext = parseCiphertext(url.searchParams.get('nameCiphertext'));
	const ip = readClientIp(getClientAddress, request.headers);
	return createSse(request, (sink) => joinChannel(self, peer, nameCiphertext, ip, sink));
};
