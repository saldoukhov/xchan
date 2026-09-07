import type { RequestHandler } from './$types';
import { parsePublicKey, sanitizeName } from '$lib/server/parse';
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
	const publicKey = parsePublicKey(url.searchParams.get('publicKey'));
	const name = sanitizeName(url.searchParams.get('name'));
	let ip = '';
	try {
		ip = getClientAddress();
	} catch {
		ip = '';
	}
	const admitted = admitPairing(publicKey, ip);
	if (!admitted.ok) {
		return admissionResponse(admitted);
	}
	return createSse(request, (sink) => joinPairing(publicKey, name, ip, sink));
};
