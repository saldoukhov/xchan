import { describe, expect, it } from 'vitest';
import {
	applyReadyExchange,
	channelExchangeChanged,
	channelHref,
	channelLabel,
	channelPeerName,
	channelSlug,
	channelTitle,
	findChannelByPeerIdentity,
	findChannelBySlug,
	mergeChannel,
	themCardNames
} from './channel';
import type { Channel } from './types';

function channel(partial: Partial<Channel> = {}): Channel {
	return {
		localPublicKey: 'local',
		localPrivateKey: {} as CryptoKey,
		localPublicCryptoKey: {} as CryptoKey,
		localIdentityPublicKey: 'local-id',
		localWords: 'abandon ability able about',
		localFingerprint: 'abandon ability able',
		localLifeHash: 'data:image/png;base64,local',
		peerPublicKey: 'key',
		peerIdentityPublicKey: 'peer-id',
		peerFingerprint: 'abandon ability able',
		peerWords: 'abandon ability able about',
		peerLifeHash: 'data:image/png;base64,peer',
		peerName: 'Pixel',
		localAlias: '',
		peerIp: '1.2.3.4',
		localIp: '10.0.0.1',
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

describe('channelTitle', () => {
	it('prefers the local alias, then the peer name', () => {
		expect(channelTitle(channel({ localAlias: "Bob's iPhone" }))).toBe("Bob's iPhone");
		expect(channelTitle(channel())).toBe('Pixel');
		expect(channelTitle(channel({ peerName: '', localAlias: '' }))).toBe('Unnamed endpoint');
	});
});

describe('channelPeerName', () => {
	it('returns the trimmed peer endpoint name', () => {
		expect(channelPeerName(channel())).toBe('Pixel');
		expect(channelPeerName(channel({ peerName: '  ' }))).toBe('');
	});
});

describe('channelHref', () => {
	it('builds a bookmarkable channel path', () => {
		expect(channelHref(channel())).toBe('/channel/abandon-ability-able');
	});
});

describe('mergeChannel', () => {
	it('keeps the local alias when the same peer pairs again', () => {
		const existing = channel({ localAlias: 'Work phone', peerIp: '1.2.3.4' });
		const incoming = channel({
			localAlias: '',
			peerPublicKey: 'new-key',
			peerIp: '5.6.7.8',
			peerName: 'Pixel 2'
		});
		const merged = mergeChannel(existing, incoming);
		expect(merged.localAlias).toBe('Work phone');
		expect(merged.peerPublicKey).toBe('new-key');
		expect(merged.peerIp).toBe('5.6.7.8');
		expect(merged.peerName).toBe('Pixel 2');
		expect(merged.peerIdentityPublicKey).toBe('peer-id');
	});

	it('keeps the stored peer name when a re-pair arrives without one', () => {
		const existing = channel({ peerName: 'Pixel' });
		const incoming = channel({ peerName: '', peerPublicKey: 'new-key' });
		expect(mergeChannel(existing, incoming).peerName).toBe('Pixel');
	});

	it('keeps the stored local IP when a re-pair arrives without one', () => {
		const existing = channel({ localIp: '73.66.155.165' });
		const incoming = channel({ localIp: '', peerPublicKey: 'new-key' });
		expect(mergeChannel(existing, incoming).localIp).toBe('73.66.155.165');
	});
});

describe('applyReadyExchange', () => {
	it('stores both parties IPs from a ready status', () => {
		const updated = applyReadyExchange(channel({ peerIp: '1.2.3.4', localIp: '' }), {
			peerIp: '198.51.100.20',
			localIp: '198.51.100.10'
		});
		expect(updated.peerIp).toBe('198.51.100.20');
		expect(updated.localIp).toBe('198.51.100.10');
		expect(channelExchangeChanged(channel({ peerIp: '1.2.3.4', localIp: '' }), updated)).toBe(true);
	});

	it('keeps stored IPs when the ready event omits them', () => {
		const existing = channel({ peerIp: '1.2.3.4', localIp: '10.0.0.1', peerName: 'Pixel' });
		const updated = applyReadyExchange(existing, { peerName: 'Pixel 2' });
		expect(updated.peerIp).toBe('1.2.3.4');
		expect(updated.localIp).toBe('10.0.0.1');
		expect(updated.peerName).toBe('Pixel 2');
	});
});

describe('themCardNames', () => {
	it('shows alias and peer name when both are set', () => {
		expect(themCardNames(channel({ localAlias: 'Work phone' }))).toEqual(['Work phone', 'Pixel']);
	});

	it('shows a single name when alias is missing or matches', () => {
		expect(themCardNames(channel())).toEqual(['Pixel']);
		expect(themCardNames(channel({ localAlias: 'Pixel' }))).toEqual(['Pixel']);
		expect(themCardNames(channel({ peerName: '', localAlias: '' }))).toEqual(['Unnamed']);
	});
});

describe('findChannelByPeerIdentity', () => {
	it('finds a channel by stable peer identity', () => {
		const channels = [
			channel(),
			channel({ peerIdentityPublicKey: 'other-id', peerPublicKey: 'other' })
		];
		expect(findChannelByPeerIdentity(channels, 'peer-id')?.peerPublicKey).toBe('key');
		expect(findChannelByPeerIdentity(channels, 'other-id')?.peerPublicKey).toBe('other');
	});
});
