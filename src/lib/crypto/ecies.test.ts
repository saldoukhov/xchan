import { describe, expect, it } from 'vitest';
import { decrypt, encrypt } from './ecies';

async function keyPair() {
	return crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
}

describe('ecies', () => {
	it('round-trips a message to a P-256 public key', async () => {
		const recipient = await keyPair();
		const raw = new Uint8Array(await crypto.subtle.exportKey('raw', recipient.publicKey));
		const plaintext = new TextEncoder().encode('hunter2');
		const ciphertext = await encrypt(plaintext, raw);
		const decrypted = await decrypt(ciphertext, recipient.privateKey);
		expect(new TextDecoder().decode(decrypted)).toBe('hunter2');
		expect(ciphertext.byteLength).toBeGreaterThan(plaintext.byteLength);
	});

	it('fails to decrypt with the wrong key', async () => {
		const recipient = await keyPair();
		const other = await keyPair();
		const raw = new Uint8Array(await crypto.subtle.exportKey('raw', recipient.publicKey));
		const ciphertext = await encrypt(new TextEncoder().encode('secret'), raw);
		await expect(decrypt(ciphertext, other.privateKey)).rejects.toThrow();
	});
});
