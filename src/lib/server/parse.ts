import { error } from '@sveltejs/kit';
import { base64ToBytes, isUncompressedP256 } from '$lib/crypto/bytes';
import { isSha256Commit } from '$lib/crypto/hash';
import { MAX_CIPHERTEXT_BYTES } from './relay';

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

export function parseCommit(value: string | null): string {
	if (!value) {
		error(400, 'commit required');
	}
	let raw: Uint8Array;
	try {
		raw = base64ToBytes(value);
	} catch {
		error(400, 'invalid commit');
	}
	if (!isSha256Commit(raw)) {
		error(400, 'invalid commit');
	}
	return value;
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
