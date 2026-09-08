import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('IdentityCard copy actions', () => {
	const source = readFileSync(new URL('./IdentityCard.svelte', import.meta.url), 'utf8');

	it('lets a distant peer copy the picture, the words, or share both', () => {
		expect(source).toContain("import Icon from '$lib/Icon.svelte'");
		expect(source).toContain('copyLifeHash');
		expect(source).toContain('copyWords');
		expect(source).toContain('shareIdentity');
		expect(source).toContain('Copy picture');
		expect(source).toContain('Copy words');
		expect(source).toContain('Share');
		expect(source).toContain('Picture copied');
		expect(source).toContain('Copy picture');
		expect(source).toContain("aria-label={wordsCopied ? 'Words copied' : 'Copy words'}");
	});
});
