import { base64ToBytes, bytesToBase64 } from './bytes';

export async function sha256Bytes(data: Uint8Array): Promise<Uint8Array> {
	return new Uint8Array(await crypto.subtle.digest('SHA-256', data as BufferSource));
}

export async function commitOfPairing(
	pairingPublicKey: string,
	identityPublicKey: string
): Promise<string> {
	const pairing = base64ToBytes(pairingPublicKey);
	const identity = base64ToBytes(identityPublicKey);
	const joined = new Uint8Array(pairing.byteLength + identity.byteLength);
	joined.set(pairing, 0);
	joined.set(identity, pairing.byteLength);
	return bytesToBase64(await sha256Bytes(joined));
}

export function isSha256Commit(raw: Uint8Array): boolean {
	return raw.byteLength === 32;
}
