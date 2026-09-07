import { bytesToBase64 } from './bytes';
import { identityFromPublicKeyRaw, type Identity } from './fingerprint';
import { commitOfPairing } from './hash';
import { deleteDatabase, loadEndpointRecord, saveEndpointRecord } from '../db';
import type { Endpoint } from '../types';

export type PairingOffer = {
	keyPair: CryptoKeyPair;
	publicKey: string;
	identityPublicKey: string;
	commit: string;
	identity: Identity;
};

async function generateKeyPair(): Promise<CryptoKeyPair> {
	return crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
}

async function toEndpoint(keyPair: CryptoKeyPair, name: string): Promise<Endpoint> {
	const raw = new Uint8Array(await crypto.subtle.exportKey('raw', keyPair.publicKey));
	return {
		name,
		identityPublicKey: bytesToBase64(raw),
		identityPrivateKey: keyPair.privateKey,
		identityPublicCryptoKey: keyPair.publicKey
	};
}

export async function loadOrCreateEndpoint(): Promise<Endpoint> {
	const existing = await loadEndpointRecord();
	if (existing?.keyPair?.privateKey && existing.keyPair.publicKey) {
		return toEndpoint(existing.keyPair, existing.name ?? '');
	}
	const keyPair = await generateKeyPair();
	await saveEndpointRecord({ keyPair, name: existing?.name ?? '' });
	return toEndpoint(keyPair, existing?.name ?? '');
}

export async function saveEndpointName(endpoint: Endpoint, name: string): Promise<Endpoint> {
	await saveEndpointRecord({
		keyPair: {
			privateKey: endpoint.identityPrivateKey,
			publicKey: endpoint.identityPublicCryptoKey
		},
		name
	});
	return { ...endpoint, name };
}

export async function resetAndCreateEndpoint(): Promise<Endpoint> {
	await deleteDatabase();
	return loadOrCreateEndpoint();
}

export async function createPairingOffer(identityPublicKey: string): Promise<PairingOffer> {
	const keyPair = await generateKeyPair();
	const raw = new Uint8Array(await crypto.subtle.exportKey('raw', keyPair.publicKey));
	const publicKey = bytesToBase64(raw);
	return {
		keyPair,
		publicKey,
		identityPublicKey,
		commit: await commitOfPairing(publicKey, identityPublicKey),
		identity: await identityFromPublicKeyRaw(raw)
	};
}
