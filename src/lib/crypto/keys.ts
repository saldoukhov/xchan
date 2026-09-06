import { bytesToBase64 } from './bytes';
import { fingerprintFromBytes } from './fingerprint';
import { deleteDatabase, loadEndpointRecord, saveEndpointRecord } from '../db';
import type { Endpoint } from '../types';

async function generateKeyPair(): Promise<CryptoKeyPair> {
	return crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
}

async function toEndpoint(keyPair: CryptoKeyPair, name: string): Promise<Endpoint> {
	const raw = new Uint8Array(await crypto.subtle.exportKey('raw', keyPair.publicKey));
	return {
		publicKey: bytesToBase64(raw),
		fingerprint: await fingerprintFromBytes(raw),
		name,
		privateKey: keyPair.privateKey,
		publicCryptoKey: keyPair.publicKey
	};
}

export async function loadOrCreateEndpoint(): Promise<Endpoint> {
	const existing = await loadEndpointRecord();
	if (existing?.keyPair?.privateKey && existing.keyPair.publicKey) {
		return toEndpoint(existing.keyPair, existing.name ?? '');
	}
	const keyPair = await generateKeyPair();
	await saveEndpointRecord({ keyPair, name: '' });
	return toEndpoint(keyPair, '');
}

export async function saveEndpointName(endpoint: Endpoint, name: string): Promise<Endpoint> {
	await saveEndpointRecord({
		keyPair: { privateKey: endpoint.privateKey, publicKey: endpoint.publicCryptoKey },
		name
	});
	return { ...endpoint, name };
}

export async function resetAndCreateEndpoint(): Promise<Endpoint> {
	await deleteDatabase();
	return loadOrCreateEndpoint();
}
