import { describe, expect, it } from 'vitest';
import {
	SW_MESSAGE,
	autoUpdateFromStored,
	isRelayPath,
	parseSwMessage,
	shouldApplyWaitingWorker,
	shouldServeCacheFirst
} from './update';

describe('autoUpdateFromStored', () => {
	it('defaults to on when nothing is stored', () => {
		expect(autoUpdateFromStored(undefined)).toBe(true);
		expect(autoUpdateFromStored(null)).toBe(true);
	});

	it('treats only explicit false as off', () => {
		expect(autoUpdateFromStored(false)).toBe(false);
		expect(autoUpdateFromStored(true)).toBe(true);
	});
});

describe('isRelayPath', () => {
	it('leaves pairing and channel API calls on the network', () => {
		expect(isRelayPath('/api')).toBe(true);
		expect(isRelayPath('/api/pair/events')).toBe(true);
		expect(isRelayPath('/api/channel/send')).toBe(true);
		expect(isRelayPath('/')).toBe(false);
		expect(isRelayPath('/how')).toBe(false);
		expect(isRelayPath('/service-worker.js')).toBe(false);
	});
});

describe('shouldServeCacheFirst', () => {
	it('always prefers the cache for hashed build assets', () => {
		expect(shouldServeCacheFirst({ autoUpdate: true, isAsset: true })).toBe(true);
		expect(shouldServeCacheFirst({ autoUpdate: false, isAsset: true })).toBe(true);
	});

	it('pins the app shell when automatic updates are off', () => {
		expect(shouldServeCacheFirst({ autoUpdate: false, isAsset: false })).toBe(true);
		expect(shouldServeCacheFirst({ autoUpdate: true, isAsset: false })).toBe(false);
	});
});

describe('update gating', () => {
	it('activates the first install even when automatic updates are off', () => {
		expect(shouldApplyWaitingWorker({ autoUpdate: false, hasController: false })).toBe(true);
		expect(shouldApplyWaitingWorker({ autoUpdate: true, hasController: false })).toBe(true);
	});

	it('leaves a later version waiting until the user updates', () => {
		expect(shouldApplyWaitingWorker({ autoUpdate: false, hasController: true })).toBe(false);
		expect(shouldApplyWaitingWorker({ autoUpdate: true, hasController: true })).toBe(true);
	});
});

describe('parseSwMessage', () => {
	it('accepts skipWaiting and auto-update messages', () => {
		expect(parseSwMessage({ type: SW_MESSAGE.skipWaiting })).toEqual({
			type: SW_MESSAGE.skipWaiting
		});
		expect(parseSwMessage({ type: SW_MESSAGE.setAutoUpdate, value: false })).toEqual({
			type: SW_MESSAGE.setAutoUpdate,
			value: false
		});
	});

	it('ignores unrelated messages', () => {
		expect(parseSwMessage('skipWaiting')).toBeUndefined();
		expect(parseSwMessage({ type: SW_MESSAGE.setAutoUpdate, value: 'no' })).toBeUndefined();
		expect(parseSwMessage(null)).toBeUndefined();
	});
});
