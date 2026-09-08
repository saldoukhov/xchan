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
});
