import { describe, expect, it } from 'vitest';
import { BIP39_WORDS } from './bip39';
import { fingerprintFromBytes } from './fingerprint';

describe('fingerprintFromBytes', () => {
	it('returns three BIP-39 words and is stable', async () => {
		const input = new Uint8Array([0, 1, 2, 3]);
		const fp = await fingerprintFromBytes(input);
		const words = fp.split(' ');
		expect(words).toHaveLength(3);
		for (const word of words) {
			expect(BIP39_WORDS.includes(word)).toBe(true);
		}
		expect(await fingerprintFromBytes(input)).toBe(fp);
	});

	it('matches SHA-256 first-three-bytes indexing', async () => {
		const input = new TextEncoder().encode('xchan');
		const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', input));
		const expected = [hash[0], hash[1], hash[2]].map((b) => BIP39_WORDS[b]).join(' ');
		expect(await fingerprintFromBytes(input)).toBe(expected);
	});
});
