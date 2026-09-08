import type { Channel } from './types';
import { AUTO_UPDATE_KEY, autoUpdateFromStored } from './update';

const DB_NAME = 'xchan';
const DB_VERSION = 3;

type EndpointRecord = {
	keyPair?: CryptoKeyPair;
	name: string;
};

function openDb(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, DB_VERSION);
		req.onupgradeneeded = (event) => {
			const db = req.result;
			const oldVersion = event.oldVersion;
			if (oldVersion < 1) {
				if (!db.objectStoreNames.contains('meta')) {
					db.createObjectStore('meta');
				}
				if (!db.objectStoreNames.contains('channels')) {
					db.createObjectStore('channels');
				}
			}
			if (oldVersion < 2 || oldVersion < 3) {
				if (db.objectStoreNames.contains('channels')) {
					db.deleteObjectStore('channels');
				}
				db.createObjectStore('channels');
			}
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

function idbRequest<T>(req: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

export async function loadEndpointRecord(): Promise<EndpointRecord | undefined> {
	const db = await openDb();
	try {
		const row = await idbRequest(
			db.transaction('meta').objectStore('meta').get('endpoint') as IDBRequest<
				EndpointRecord | undefined
			>
		);
		if (!row) return undefined;
		return { name: row.name ?? '', keyPair: row.keyPair };
	} finally {
		db.close();
	}
}

export async function saveEndpointRecord(record: EndpointRecord): Promise<void> {
	const db = await openDb();
	try {
		await idbRequest(
			db.transaction('meta', 'readwrite').objectStore('meta').put(record, 'endpoint')
		);
	} finally {
		db.close();
	}
}

export async function loadAutoUpdate(): Promise<boolean> {
	const db = await openDb();
	try {
		const value = await idbRequest(
			db.transaction('meta').objectStore('meta').get(AUTO_UPDATE_KEY) as IDBRequest<unknown>
		);
		return autoUpdateFromStored(value);
	} finally {
		db.close();
	}
}

export async function saveAutoUpdate(enabled: boolean): Promise<void> {
	const db = await openDb();
	try {
		await idbRequest(
			db.transaction('meta', 'readwrite').objectStore('meta').put(enabled, AUTO_UPDATE_KEY)
		);
	} finally {
		db.close();
	}
}

export async function listChannels(): Promise<Channel[]> {
	const db = await openDb();
	try {
		const rows = await idbRequest(
			db.transaction('channels').objectStore('channels').getAll() as IDBRequest<Channel[]>
		);
		return rows ?? [];
	} finally {
		db.close();
	}
}

export async function putChannel(channel: Channel): Promise<void> {
	const db = await openDb();
	try {
		await idbRequest(
			db
				.transaction('channels', 'readwrite')
				.objectStore('channels')
				.put(channel, channel.peerIdentityPublicKey)
		);
	} finally {
		db.close();
	}
}

export async function deleteChannel(peerIdentityPublicKey: string): Promise<void> {
	const db = await openDb();
	try {
		await idbRequest(
			db.transaction('channels', 'readwrite').objectStore('channels').delete(peerIdentityPublicKey)
		);
	} finally {
		db.close();
	}
}

/** Drops the local identity and every stored channel. */
export function deleteDatabase(): Promise<void> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.deleteDatabase(DB_NAME);
		const timer = setTimeout(() => resolve(), 2000);
		req.onsuccess = () => {
			clearTimeout(timer);
			resolve();
		};
		req.onerror = () => {
			clearTimeout(timer);
			reject(req.error ?? new Error('Could not reset this device'));
		};
	});
}
