import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { APP_VERSION, RELEASES, parseWhatsNew, whatsNewPayload } from './releases';

describe('releases', () => {
	it('keeps the running version in sync with package.json and the newest notes', () => {
		const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
			version: string;
		};
		expect(APP_VERSION).toBe(pkg.version);
		expect(RELEASES[0]?.version).toBe(APP_VERSION);
	});

	it('ships at least one release with notes', () => {
		expect(RELEASES.length).toBeGreaterThan(0);
		expect(RELEASES[0]?.notes.length).toBeGreaterThan(0);
		expect(whatsNewPayload()).toEqual({ version: APP_VERSION, releases: RELEASES });
	});

	it('accepts a well-formed payload from the host', () => {
		const parsed = parseWhatsNew({
			version: '1.1.0',
			releases: [
				{ version: '1.1.0', date: '2026-10-01', notes: ['A fix.'] },
				{ version: '1.0.0', date: '2026-09-07', notes: ['First release.'] }
			]
		});
		expect(parsed?.version).toBe('1.1.0');
		expect(parsed?.releases).toHaveLength(2);
		expect(parsed?.releases[0]?.notes).toEqual(['A fix.']);
	});

	it('rejects a truncated or empty payload', () => {
		expect(parseWhatsNew(null)).toBeUndefined();
		expect(parseWhatsNew({ version: '1.0.0' })).toBeUndefined();
		expect(parseWhatsNew({ version: '1.0.0', releases: [] })).toBeUndefined();
		expect(
			parseWhatsNew({
				version: '1.0.0',
				releases: [{ version: '1.0.0', date: '2026-09-07', notes: [] }]
			})
		).toBeUndefined();
	});
});
