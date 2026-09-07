import { describe, expect, it } from 'vitest';
import { bytesToBase64 } from './crypto/bytes';
import { decryptName, encryptName, MAX_NAME_CHARS, sanitizeName } from './name';

async function pairingKey() {
	return crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
}

describe('sanitizeName', () => {
	it('strips control characters and caps length', () => {
		expect(sanitizeName('MacBook')).toBe('MacBook');
		expect(sanitizeName('  Pixel\n2')).toBe('Pixel2');
		expect(sanitizeName('a'.repeat(MAX_NAME_CHARS + 8))).toHaveLength(MAX_NAME_CHARS);
		expect(sanitizeName(null)).toBe('');
	});
});

describe('encryptName', () => {
	it('round-trips an endpoint name to a pairing public key', async () => {
		const recipient = await pairingKey();
		const publicKey = bytesToBase64(
			new Uint8Array(await crypto.subtle.exportKey('raw', recipient.publicKey))
		);
		const ciphertext = await encryptName('MacBook', publicKey);
		expect(ciphertext).not.toContain('MacBook');
		expect(await decryptName(ciphertext, recipient.privateKey)).toBe('MacBook');
	});

	it('encrypts an empty name to ciphertext the peer can decrypt', async () => {
		const recipient = await pairingKey();
		const publicKey = bytesToBase64(
			new Uint8Array(await crypto.subtle.exportKey('raw', recipient.publicKey))
		);
		const ciphertext = await encryptName('', publicKey);
		expect(ciphertext.length).toBeGreaterThan(0);
		expect(await decryptName(ciphertext, recipient.privateKey)).toBe('');
	});
});
