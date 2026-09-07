import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('web app manifest', () => {
	const manifest = JSON.parse(readFileSync('static/manifest.webmanifest', 'utf8')) as {
		name: string;
		short_name: string;
		start_url: string;
		display: string;
		icons: { src: string; sizes: string; type: string; purpose: string }[];
	};

	it('has the fields browsers need to install the app', () => {
		expect(manifest.name).toBe('XChan');
		expect(manifest.short_name).toBe('XChan');
		expect(manifest.start_url).toBe('/');
		expect(manifest.display).toBe('standalone');
		expect(manifest.icons).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ sizes: '192x192', type: 'image/png' }),
				expect.objectContaining({ sizes: '512x512', type: 'image/png' })
			])
		);
	});
});
