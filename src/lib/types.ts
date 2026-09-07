export type Channel = {
	localPublicKey: string;
	localPrivateKey: CryptoKey;
	localPublicCryptoKey: CryptoKey;
	localIdentityPublicKey: string;
	localWords: string;
	localFingerprint: string;
	localLifeHash: string;
	peerPublicKey: string;
	peerIdentityPublicKey: string;
	peerFingerprint: string;
	peerWords: string;
	peerLifeHash: string;
	peerName: string;
	localAlias: string;
	peerIp: string;
	localIp: string;
};

export type Endpoint = {
	name: string;
	identityPublicKey: string;
	identityPrivateKey: CryptoKey;
	identityPublicCryptoKey: CryptoKey;
};

export type PairEvent =
	| { type: 'waiting' }
	| { type: 'reveal'; peerCommit: string }
	| {
			type: 'paired';
			peerPublicKey: string;
			peerIdentityPublicKey: string;
			peerIp: string;
	  }
	| { type: 'timeout' }
	| { type: 'cancelled' }
	| { type: 'rejected'; reason: 'same-device' };

export type ChannelEvent =
	| {
			type: 'status';
			ready: boolean;
			peerNameCiphertext?: string;
			peerIp?: string;
			selfIp?: string;
	  }
	| { type: 'message'; ciphertext: string };
