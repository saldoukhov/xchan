import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('home menu', () => {
	const page = readFileSync(new URL('./+page.svelte', import.meta.url), 'utf8');

	it('lets the user turn off automatic updates and check manually', () => {
		expect(page).toContain('Automatically update');
		expect(page).toContain('Check for update');
		expect(page).toContain('toggleAutoUpdate');
		expect(page).toContain('checkForUpdate');
		expect(page).toContain('this device keeps the current app until you choose to update');
	});

	it('shows a home-screen banner when a new version is waiting', () => {
		expect(page).toContain('updateState.updateAvailable');
		expect(page).toContain('New version');
		expect(page).toContain('This device will keep the current app until you update.');
		expect(page).toContain('applyWaitingUpdate');
		expect(page).toContain('Later');
		expect(page).toContain('Update');
		expect(page).toContain("resolve('/whats-new')");
		expect(page).toContain('What’s new');
	});
});
