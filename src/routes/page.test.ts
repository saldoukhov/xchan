import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { en } from '$lib/i18n/en';

describe('home menu', () => {
	const page = readFileSync(new URL('./+page.svelte', import.meta.url), 'utf8');

	it('lets the user turn off automatic updates and check manually', () => {
		expect(page).toContain('m.menu.autoUpdate');
		expect(page).toContain('m.menu.checkForUpdate');
		expect(page).toContain('toggleAutoUpdate');
		expect(page).toContain('checkForUpdate');
		expect(page).toContain('m.menu.autoUpdateHint');
		expect(en.menu.autoUpdate).toBe('Automatically update');
		expect(en.menu.autoUpdateHint).toContain(
			'this device keeps the current app until you choose to update'
		);
	});

	it('shows a home-screen banner when a new version is waiting', () => {
		expect(page).toContain('updateState.updateAvailable');
		expect(page).toContain('m.home.newVersion');
		expect(page).toContain('m.home.updateBanner');
		expect(page).toContain('applyWaitingUpdate');
		expect(page).toContain('m.home.later');
		expect(page).toContain('m.home.update');
		expect(page).toContain("resolve('/whats-new')");
		expect(page).toContain('m.common.whatsNew');
		expect(en.home.updateBanner).toContain(
			'This device will keep the current app until you update.'
		);
	});

	it('shows the running version next to the title', () => {
		expect(page).toContain('APP_VERSION');
		expect(page).toContain('class="ver"');
		expect(page).toContain("resolve('/whats-new')");
		expect(page).toContain('m.home.versionAria');
	});

	it('lets the user pick a language from the menu', () => {
		expect(page).toContain("menuPanel === 'language'");
		expect(page).toContain('selectLocale');
		expect(page).toContain('LOCALES');
		expect(page).toContain('LOCALE_LABELS');
		expect(page).toContain('m.menu.language');
		expect(en.menu.language).toBe('Language');
	});
});
