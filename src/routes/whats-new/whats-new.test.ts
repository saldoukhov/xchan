import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { APP_VERSION, RELEASES } from '$lib/releases';

describe('what’s new page', () => {
	const page = readFileSync(new URL('./+page.svelte', import.meta.url), 'utf8');

	it('shows this device version and loads host notes before updating', () => {
		expect(page).toContain('m.whatsNew.title');
		expect(page).toContain('APP_VERSION');
		expect(page).toContain('/whats-new.json');
		expect(page).toContain("cache: 'no-store'");
		expect(page).toContain('m.whatsNew.onThisDevice');
		expect(page).toContain('m.whatsNew.onTheServer');
	});

	it('is backed by the shipped release list', () => {
		expect(RELEASES[0]?.version).toBe(APP_VERSION);
		expect(RELEASES[0]?.notes.join(' ')).toMatch(/separator/i);
	});
});
