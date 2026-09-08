import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('how it works page', () => {
	const page = readFileSync(new URL('./+page.svelte', import.meta.url), 'utf8');

	it('explains pairing and the comparison check in plain language', () => {
		expect(page).toContain('a friend');
		expect(page).toContain('Keep a channel for years');
		expect(page).toContain('Press <strong>Pair</strong> on both within 15 seconds.');
		expect(page).toContain('class="warn"');
		expect(page).toContain(
			'If the picture or the words do not match, delete the channel and pair again. Do not send.'
		);
		expect(page).toContain('full 24-word list');
		expect(page).toContain('The three words in the channel list are only a label.');
		expect(page).toContain('copy the picture and the word list from the card');
		expect(page).toContain('The picture and words are not a secret');
		expect(page).toContain('not a recovery phrase');
	});

	it('says what the relay can and cannot see', () => {
		expect(page).toContain('It cannot read names, message text, or file contents.');
		expect(page).toContain('IP addresses');
		expect(page).toContain('turn off automatic updates in the menu');
		expect(page).toContain('A banner on the');
		expect(page).toContain('home screen tells you when a new version is waiting, with a link to');
		expect(page).toContain('What’s new');
	});

	it('covers public source, audit, and agent review', () => {
		expect(page).toContain('https://github.com/saldoukhov/xchan');
		expect(page).toContain('https://scorecard.dev/viewer/?uri=github.com/saldoukhov/xchan');
		expect(page).toContain('The code is public and has been audited.');
		expect(page).toContain('including with an AI agent');
		expect(page).toContain('Paste this into any coding agent:');
		expect(page).toContain('The site does not do this check for you.');
		expect(page).toContain('less incentive to hack it');
		expect(page).toContain('You can pin the client on this device.');
		expect(page).toContain('turn off automatic updates');
		expect(page).toContain('quietly replace the copy you already have');
	});
});
