const EPHEMERAL_PUB_LEN = 65;
const IV_LEN = 12;
const GCM_TAG_LEN = 16;

async function aesKeyFromSharedSecret(sharedSecret: ArrayBuffer): Promise<CryptoKey> {
	const digest = await crypto.subtle.digest('SHA-256', sharedSecret);
	return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

/** Keeper Secrets Manager–style ECIES: ephemeral P-256 ECDH, SHA-256(secret), AES-GCM. */
export async function encrypt(
	plaintext: Uint8Array,
	recipientPublicKeyRaw: Uint8Array
): Promise<Uint8Array> {
	const ephemeralKeyPair = await crypto.subtle.generateKey(
		{ name: 'ECDH', namedCurve: 'P-256' },
		false,
		['deriveBits']
	);
	const ephemeralPublicKey = new Uint8Array(
		await crypto.subtle.exportKey('raw', ephemeralKeyPair.publicKey)
	);
	const recipientPublicKey = await crypto.subtle.importKey(
		'raw',
		recipientPublicKeyRaw as BufferSource,
		{ name: 'ECDH', namedCurve: 'P-256' },
		true,
		[]
	);
	const sharedSecret = await crypto.subtle.deriveBits(
		{ name: 'ECDH', public: recipientPublicKey },
		ephemeralKeyPair.privateKey,
		256
	);
	const aesKey = await aesKeyFromSharedSecret(sharedSecret);
	const iv = crypto.getRandomValues(new Uint8Array(IV_LEN));
	const encrypted = new Uint8Array(
		await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, plaintext as BufferSource)
	);
	const result = new Uint8Array(
		ephemeralPublicKey.byteLength + iv.byteLength + encrypted.byteLength
	);
	result.set(ephemeralPublicKey, 0);
	result.set(iv, ephemeralPublicKey.byteLength);
	result.set(encrypted, ephemeralPublicKey.byteLength + iv.byteLength);
	return result;
}

export async function decrypt(ciphertext: Uint8Array, privateKey: CryptoKey): Promise<Uint8Array> {
	if (ciphertext.byteLength < EPHEMERAL_PUB_LEN + IV_LEN + GCM_TAG_LEN) {
		throw new Error('ciphertext too short');
	}
	const ephemeralPublicKeyRaw = ciphertext.subarray(0, EPHEMERAL_PUB_LEN);
	const iv = ciphertext.subarray(EPHEMERAL_PUB_LEN, EPHEMERAL_PUB_LEN + IV_LEN);
	const encrypted = ciphertext.subarray(EPHEMERAL_PUB_LEN + IV_LEN);
	const ephemeralPublicKey = await crypto.subtle.importKey(
		'raw',
		ephemeralPublicKeyRaw as BufferSource,
		{ name: 'ECDH', namedCurve: 'P-256' },
		true,
		[]
	);
	const sharedSecret = await crypto.subtle.deriveBits(
		{ name: 'ECDH', public: ephemeralPublicKey },
		privateKey,
		256
	);
	const aesKey = await aesKeyFromSharedSecret(sharedSecret);
	return new Uint8Array(
		await crypto.subtle.decrypt(
			{ name: 'AES-GCM', iv: iv as BufferSource },
			aesKey,
			encrypted as BufferSource
		)
	);
}
