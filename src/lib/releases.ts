export type Release = {
	version: string;
	date: string;
	notes: string[];
};

export type WhatsNew = {
	version: string;
	releases: Release[];
};

/** Keep equal to package.json version. Newest release first. */
export const APP_VERSION = '1.1.2';

export const RELEASES: Release[] = [
	{
		version: '1.1.2',
		date: '2026-09-08',
		notes: [
			'Two devices on the same network pair with each other first, so a laptop and phone on the same Wi-Fi are less likely to match a stranger.',
			'Several people behind the same network can pair at once. Pairing two devices on that network no longer uses up the network’s pairing budget.'
		]
	},
	{
		version: '1.1.1',
		date: '2026-09-08',
		notes: ['The home screen shows this device’s version next to the title.']
	},
	{
		version: '1.1.0',
		date: '2026-09-08',
		notes: ['Choose a language from the menu: English, Spanish, Russian, French, or German.']
	},
	{
		version: '1.0.0',
		date: '2026-09-08',
		notes: [
			'Pair two devices in 15 seconds and send a short secret or a file up to 50 MB.',
			'Compare LifeHash and the 24-word grid before sending.',
			'Keys stay on this device. The server is a relay.',
			'Automatic updates can be turned off. A home-screen banner appears when a new version is waiting.',
			'This What’s new page lists each release. Pinned devices can read it before they update.'
		]
	}
];

export function whatsNewPayload(): WhatsNew {
	return { version: APP_VERSION, releases: RELEASES };
}

export function parseWhatsNew(data: unknown): WhatsNew | undefined {
	if (typeof data !== 'object' || data === null) return undefined;
	if (!('version' in data) || !isNonEmptyString(data.version)) return undefined;
	if (!('releases' in data) || !Array.isArray(data.releases)) return undefined;
	const releases: Release[] = [];
	for (const item of data.releases) {
		const release = parseRelease(item);
		if (!release) return undefined;
		releases.push(release);
	}
	if (releases.length === 0) return undefined;
	return { version: data.version.trim(), releases };
}

function parseRelease(data: unknown): Release | undefined {
	if (typeof data !== 'object' || data === null) return undefined;
	if (!('version' in data) || !isNonEmptyString(data.version)) return undefined;
	if (!('date' in data) || !isNonEmptyString(data.date)) return undefined;
	if (!('notes' in data) || !Array.isArray(data.notes)) return undefined;
	const notes: string[] = [];
	for (const note of data.notes) {
		if (!isNonEmptyString(note)) return undefined;
		notes.push(note.trim());
	}
	if (notes.length === 0) return undefined;
	return { version: data.version.trim(), date: data.date.trim(), notes };
}

function isNonEmptyString(value: unknown): value is string {
	return typeof value === 'string' && value.trim().length > 0;
}
