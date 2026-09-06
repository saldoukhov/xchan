import type { Channel } from './types';

export function channelLabel(channel: Channel): string {
	if (channel.localAlias && channel.peerName) {
		return `${channel.localAlias} (${channel.peerName})`;
	}
	return channel.localAlias || channel.peerName || 'Unnamed endpoint';
}

export function channelSlug(fingerprint: string): string {
	return fingerprint.trim().toLowerCase().split(/\s+/).filter(Boolean).join('-');
}

export function findChannelBySlug(channels: Channel[], slug: string): Channel | undefined {
	const normalized = channelSlug(slug);
	return channels.find((channel) => channelSlug(channel.peerFingerprint) === normalized);
}

export function channelHref(channel: Channel): string {
	return `/channel/${channelSlug(channel.peerFingerprint)}`;
}
