import { LifeHash, LifeHashVersion } from 'lifehash';
import { BIP39_WORDS } from './bip39';
import { sha256Bytes } from './hash';

export type Identity = {
	words: string;
	fingerprint: string;
	lifeHash: string;
};

export function shortFingerprint(words: string): string {
	return words.trim().split(/\s+/).filter(Boolean).slice(0, 3).join(' ');
}

export async function mnemonicFromEntropy(entropy: Uint8Array): Promise<string> {
	if (entropy.byteLength !== 32) {
		throw new Error('BIP-39 entropy must be 32 bytes');
	}
	const checksum = await sha256Bytes(entropy);
	const bits: number[] = [];
	for (const byte of entropy) {
		for (let i = 7; i >= 0; i--) bits.push((byte >> i) & 1);
	}
	for (let i = 7; i >= 0; i--) bits.push((checksum[0] >> i) & 1);
	const words: string[] = [];
	for (let i = 0; i < 24; i++) {
		let index = 0;
		for (let j = 0; j < 11; j++) {
			index = (index << 1) | bits[i * 11 + j];
		}
		words.push(BIP39_WORDS[index]);
	}
	return words.join(' ');
}

export async function identityFromPublicKeyRaw(raw: Uint8Array): Promise<Identity> {
	const digest = await sha256Bytes(raw);
	const words = await mnemonicFromEntropy(digest);
	const image = LifeHash.makeFromDigest(digest, LifeHashVersion.detailed, 1, true);
	return {
		words,
		fingerprint: shortFingerprint(words),
		lifeHash: image.toDataUrl()
	};
}
