import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('link preview', () => {
	const html = readFileSync(new URL('./app.html', import.meta.url), 'utf8');
	const image = readFileSync(new URL('../static/og-image.png', import.meta.url));

	it('puts Open Graph and X card tags in the document crawlers fetch', () => {
		expect(html).toContain('property="og:title" content="XChan"');
		expect(html).toContain(
			'property="og:description" content="Pair two devices and send an ephemeral secret."'
		);
		expect(html).toContain('property="og:url" content="https://xchan.dev/"');
		expect(html).toContain('property="og:image" content="https://xchan.dev/og-image.png"');
		expect(html).toContain('name="twitter:card" content="summary_large_image"');
		expect(html).toContain('name="twitter:image" content="https://xchan.dev/og-image.png"');
	});

	it('ships a 1200×630 PNG for the preview image', () => {
		expect(image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))).toBe(true);
		expect(image.readUInt32BE(16)).toBe(1200);
		expect(image.readUInt32BE(20)).toBe(630);
	});
});
