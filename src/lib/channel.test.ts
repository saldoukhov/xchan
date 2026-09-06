import { describe, expect, it } from 'vitest';
import { channelHref, channelLabel, channelSlug, findChannelBySlug } from './channel';
import type { Channel } from './types';

function channel(partial: Partial<Channel> = {}): Channel {
	return {
		peerPublicKey: 'key',
		peerFingerprint: 'abandon ability able',
		peerName: 'Pixel',
		localAlias: '',
		peerIp: '1.2.3.4',
		...partial
	};
}

describe('channelSlug', () => {
	it('turns a three-word fingerprint into a path segment', () => {
		expect(channelSlug('abandon ability able')).toBe('abandon-ability-able');
	});

	it('is stable for already-slug fingerprints', () => {
		expect(channelSlug('abandon-ability-able')).toBe('abandon-ability-able');
	});
});

describe('findChannelBySlug', () => {
	it('matches a channel by fingerprint slug', () => {
		const channels = [
			channel(),
			channel({ peerPublicKey: 'other', peerFingerprint: 'acid acoustic acquire' })
		];
		expect(findChannelBySlug(channels, 'abandon-ability-able')?.peerPublicKey).toBe('key');
		expect(findChannelBySlug(channels, 'acid acoustic acquire')?.peerPublicKey).toBe('other');
		expect(findChannelBySlug(channels, 'missing-missing-missing')).toBeUndefined();
	});
});

describe('channelLabel', () => {
	it('prefers local alias and shows both names when present', () => {
		expect(channelLabel(channel())).toBe('Pixel');
		expect(channelLabel(channel({ localAlias: 'Work phone' }))).toBe('Work phone (Pixel)');
		expect(channelLabel(channel({ peerName: '', localAlias: '' }))).toBe('Unnamed endpoint');
	});
});

describe('channelHref', () => {
	it('builds a bookmarkable channel path', () => {
		expect(channelHref(channel())).toBe('/channel/abandon-ability-able');
	});
});
