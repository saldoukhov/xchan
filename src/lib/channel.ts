import type { Channel } from './types';

export function channelLabel(channel: Channel): string {
	if (channel.localAlias && channel.peerName) {
		return `${channel.localAlias} (${channel.peerName})`;
	}
	return channel.localAlias || channel.peerName || 'Unnamed endpoint';
}

export function channelTitle(channel: Channel): string {
	const alias = channel.localAlias.trim();
	if (alias) return alias;
	const peer = channel.peerName.trim();
	if (peer) return peer;
	return 'Unnamed endpoint';
}

export function channelPeerName(channel: Channel): string {
	return channel.peerName.trim();
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

export function mergeChannel(existing: Channel | undefined, incoming: Channel): Channel {
	if (!existing) return incoming;
	return {
		...incoming,
		localAlias: incoming.localAlias || existing.localAlias,
		peerName: incoming.peerName || existing.peerName
	};
}

export function findChannelByPeerIdentity(
	channels: Channel[],
	peerIdentityPublicKey: string
): Channel | undefined {
	return channels.find((channel) => channel.peerIdentityPublicKey === peerIdentityPublicKey);
}

export function themCardNames(channel: Channel): string[] {
	const peer = channel.peerName.trim();
	const alias = channel.localAlias.trim();
	if (alias && peer && alias !== peer) return [alias, peer];
	if (alias) return [alias];
	if (peer) return [peer];
	return ['Unnamed'];
}
