import { base64ToBytes, bytesToBase64 } from './crypto/bytes';
import { decrypt, encrypt } from './crypto/ecies';

export const MAX_NAME_CHARS = 64;

export function sanitizeName(name: string | null | undefined): string {
	if (!name) return '';
	return [...name]
		.filter((ch) => ch >= ' ')
		.join('')
		.trim()
		.slice(0, MAX_NAME_CHARS);
}

export async function encryptName(name: string, peerPublicKeyB64: string): Promise<string> {
	const plaintext = new TextEncoder().encode(sanitizeName(name));
	const ciphertext = await encrypt(plaintext, base64ToBytes(peerPublicKeyB64));
	return bytesToBase64(ciphertext);
}

export async function decryptName(ciphertextB64: string, privateKey: CryptoKey): Promise<string> {
	const plain = await decrypt(base64ToBytes(ciphertextB64), privateKey);
	return sanitizeName(new TextDecoder().decode(plain));
}
