export const AUTO_UPDATE_KEY = 'autoUpdate';

export const SW_MESSAGE = {
	skipWaiting: 'xchan-skip-waiting',
	setAutoUpdate: 'xchan-set-auto-update'
} as const;

export type SwMessage =
	| { type: typeof SW_MESSAGE.skipWaiting }
	| { type: typeof SW_MESSAGE.setAutoUpdate; value: boolean };

export function autoUpdateFromStored(value: unknown): boolean {
	return value !== false;
}

export function isRelayPath(pathname: string): boolean {
	return pathname === '/api' || pathname.startsWith('/api/');
}

export function isLiveNotesPath(pathname: string): boolean {
	return pathname === '/whats-new.json';
}

export function shouldServeCacheFirst(opts: { autoUpdate: boolean; isAsset: boolean }): boolean {
	return opts.isAsset || !opts.autoUpdate;
}

export function shouldApplyWaitingWorker(opts: {
	autoUpdate: boolean;
	hasController: boolean;
}): boolean {
	if (!opts.hasController) return true;
	return opts.autoUpdate;
}

export function parseSwMessage(data: unknown): SwMessage | undefined {
	if (typeof data !== 'object' || data === null) return undefined;
	if (!('type' in data) || typeof data.type !== 'string') return undefined;
	if (data.type === SW_MESSAGE.skipWaiting) return { type: SW_MESSAGE.skipWaiting };
	if (data.type === SW_MESSAGE.setAutoUpdate) {
		if (!('value' in data) || typeof data.value !== 'boolean') return undefined;
		return { type: SW_MESSAGE.setAutoUpdate, value: data.value };
	}
	return undefined;
}
