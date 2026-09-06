export type Channel = {
	peerPublicKey: string;
	peerFingerprint: string;
	peerName: string;
	localAlias: string;
	peerIp: string;
};

export type Endpoint = {
	publicKey: string;
	fingerprint: string;
	name: string;
	privateKey: CryptoKey;
	publicCryptoKey: CryptoKey;
};

export type PairEvent =
	| { type: 'waiting' }
	| { type: 'paired'; peerPublicKey: string; peerName: string; peerIp: string }
	| { type: 'timeout' }
	| { type: 'cancelled' };

export type ChannelEvent =
	{ type: 'status'; ready: boolean } | { type: 'message'; ciphertext: string };
