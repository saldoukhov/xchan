import { error } from '@sveltejs/kit';
import { base64ToBytes, isUncompressedP256 } from '$lib/crypto/bytes';
import { MAX_CIPHERTEXT_BYTES, MAX_NAME_CHARS } from './relay';

export function parsePublicKey(value: string | null): string {
	if (!value) {
		error(400, 'publicKey required');
	}
	let raw: Uint8Array;
	try {
		raw = base64ToBytes(value);
	} catch {
		error(400, 'invalid publicKey');
	}
	if (!isUncompressedP256(raw)) {
		error(400, 'invalid publicKey');
	}
	return value;
}

export function sanitizeName(name: string | null | undefined): string {
	if (!name) return '';
	return [...name]
		.filter((ch) => ch >= ' ')
		.join('')
		.slice(0, MAX_NAME_CHARS);
}

export function parseCiphertext(value: unknown): string {
	if (typeof value !== 'string' || value.length === 0) {
		error(400, 'ciphertext required');
	}
	let raw: Uint8Array;
	try {
		raw = base64ToBytes(value);
	} catch {
		error(400, 'invalid ciphertext');
	}
	if (raw.byteLength > MAX_CIPHERTEXT_BYTES) {
		error(413, 'ciphertext too large');
	}
	return value;
}
