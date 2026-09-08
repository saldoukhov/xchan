import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { en } from '$lib/i18n/en';

describe('how it works page', () => {
	const page = readFileSync(new URL('./+page.svelte', import.meta.url), 'utf8');

	it('explains pairing and the comparison check in plain language', () => {
		expect(en.how.lede1).toContain('a friend');
		expect(en.how.lede2).toContain('Keep a channel for years');
		expect(en.how.step3).toContain('<strong>Pair</strong>');
		expect(en.how.step3).toContain('within {seconds} seconds.');
		expect(page).toContain('class="warn"');
		expect(en.how.warn).toBe(
			'If the picture or the words do not match, delete the channel and pair again. Do not send.'
		);
		expect(en.how.check1).toContain('full 24-word list');
		expect(en.how.check4).toContain('The three words in the channel list are only a label.');
		expect(en.how.check2).toContain('copy the picture and the word list from the card');
		expect(en.how.check3).toContain('The picture and words are not a secret');
		expect(en.how.check3).toContain('not a recovery phrase');
	});

	it('says what the relay can and cannot see', () => {
		expect(en.how.onServer3).toContain('It cannot read names, message text, or file contents.');
		expect(en.how.onServer2).toContain('IP addresses');
		expect(en.how.onDevice4).toContain('turn off automatic updates in the menu');
		expect(en.how.onDevice4).toContain('A banner on the');
		expect(en.how.onDevice4).toContain(
			'home screen tells you when a new version is waiting, with a link to'
		);
		expect(en.how.onDevice4).toContain('What’s new');
	});

	it('covers public source, audit, and agent review', () => {
		expect(page).toContain('https://github.com/saldoukhov/xchan');
		expect(page).toContain('https://scorecard.dev/viewer/?uri=github.com/saldoukhov/xchan');
		expect(en.how.trustCodeTitle).toContain('The code is public and has been audited.');
		expect(en.how.trustCodeBody).toContain('including with an AI agent');
		expect(en.how.pastePrompt).toContain('Paste this into any coding agent:');
		expect(en.how.trustCheckBody).toContain('The site does not do this check for you.');
		expect(en.how.trustSmallBody).toContain('less incentive to hack it');
		expect(en.how.trustPinTitle).toContain('You can pin the client on this device.');
		expect(en.how.trustPinBody).toContain('Turn them off after you install');
		expect(en.how.trustPinBody).toContain('quietly replace the copy you already have');
	});
});
