import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('IdentityCard copy actions', () => {
	const source = readFileSync(new URL('./IdentityCard.svelte', import.meta.url), 'utf8');

	it('lets a distant peer copy the picture, the words, or share both', () => {
		expect(source).toContain("import Icon from '$lib/Icon.svelte'");
		expect(source).toContain('copyLifeHash');
		expect(source).toContain('copyWords');
		expect(source).toContain('shareIdentity');
		expect(source).toContain('i18n.m.card.copyPicture');
		expect(source).toContain('i18n.m.card.copyWords');
		expect(source).toContain('i18n.m.card.share');
		expect(source).toContain('i18n.m.card.pictureCopied');
		expect(source).toContain('i18n.m.card.wordsCopied');
	});
});
