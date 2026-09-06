import { BIP39_WORDS } from './bip39';

/** r2p-style fingerprint: SHA-256, first three bytes → BIP-39 words. */
export async function fingerprintFromBytes(data: Uint8Array): Promise<string> {
	const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', data as BufferSource));
	const words: string[] = [];
	for (let i = 0; i < 3; i++) {
		words.push(BIP39_WORDS[hash[i]]);
	}
	return words.join(' ');
}
