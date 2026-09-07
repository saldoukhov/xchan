import type { RequestHandler } from './$types';
import { readClientIp } from '$lib/server/client-ip';
import { parseCommit, parsePublicKey } from '$lib/server/parse';
import { admitPairing, joinPairing, type PairingAdmission } from '$lib/server/relay';
import { createSse } from '$lib/server/sse';

function admissionResponse(result: Extract<PairingAdmission, { ok: false }>): Response {
	return new Response(result.message, {
		status: result.status,
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
			'Retry-After': String(result.retryAfterSec),
			'Cache-Control': 'no-store'
		}
	});
}

export const GET: RequestHandler = ({ url, request, getClientAddress }) => {
	const commit = parseCommit(url.searchParams.get('commit'));
	const identityPublicKey = parsePublicKey(url.searchParams.get('identityPublicKey'));
	const ip = readClientIp(getClientAddress);
	const admitted = admitPairing(commit, ip);
	if (!admitted.ok) {
		return admissionResponse(admitted);
	}
	return createSse(request, (sink) => joinPairing(commit, identityPublicKey, ip, sink));
};
