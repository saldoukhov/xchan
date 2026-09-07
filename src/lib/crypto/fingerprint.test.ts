import { describe, expect, it } from 'vitest';
import { BIP39_WORDS } from './bip39';
import { identityFromPublicKeyRaw, mnemonicFromEntropy, shortFingerprint } from './fingerprint';

describe('BIP39_WORDS', () => {
	it('is the official 2048-word English list', () => {
		expect(BIP39_WORDS).toHaveLength(2048);
		expect(BIP39_WORDS[0]).toBe('abandon');
		expect(BIP39_WORDS[2047]).toBe('zoo');
	});
});

describe('mnemonicFromEntropy', () => {
	it('encodes 32 zero bytes as the standard 24-word vector', async () => {
		const words = await mnemonicFromEntropy(new Uint8Array(32));
		expect(words.split(' ')).toHaveLength(24);
		expect(words).toBe(
			'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art'
		);
	});
});

describe('shortFingerprint', () => {
	it('takes the first three words', () => {
		expect(shortFingerprint('abandon ability able about above')).toBe('abandon ability able');
	});
});

describe('identityFromPublicKeyRaw', () => {
	it('returns 24 words, a 3-word label, and a LifeHash data URL', async () => {
		const raw = new Uint8Array(65);
		raw[0] = 0x04;
		raw[1] = 7;
		const id = await identityFromPublicKeyRaw(raw);
		const words = id.words.split(' ');
		expect(words).toHaveLength(24);
		for (const word of words) {
			expect(BIP39_WORDS.includes(word)).toBe(true);
		}
		expect(id.fingerprint).toBe(words.slice(0, 3).join(' '));
		expect(id.lifeHash.startsWith('data:image/png;base64,')).toBe(true);
	});
});
