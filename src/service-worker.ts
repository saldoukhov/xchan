/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />
/// <reference types="@sveltejs/kit" />

import { build, files, version } from '$service-worker';
import { loadAutoUpdate } from '$lib/db';
import { isRelayPath, parseSwMessage, shouldServeCacheFirst, SW_MESSAGE } from '$lib/update';

const self = globalThis.self as unknown as ServiceWorkerGlobalScope;

const CACHE = `xchan-${version}`;
const ASSETS = [...build, ...files];

let autoUpdate = true;
const prefReady = loadAutoUpdate()
	.then((value) => {
		autoUpdate = value;
	})
	.catch(() => {
		autoUpdate = true;
	});

self.addEventListener('install', (event) => {
	async function addFilesToCache() {
		const cache = await caches.open(CACHE);
		await cache.addAll(ASSETS);
		try {
			await cache.add('/');
		} catch {
			// Shell is cached on the first navigation if this fetch fails.
		}
	}

	event.waitUntil(addFilesToCache());
});

self.addEventListener('activate', (event) => {
	async function deleteOldCaches() {
		await prefReady;
		for (const key of await caches.keys()) {
			if (key !== CACHE) await caches.delete(key);
		}
		await self.clients.claim();
	}

	event.waitUntil(deleteOldCaches());
});

self.addEventListener('message', (event) => {
	const message = parseSwMessage(event.data);
	if (!message) return;
	if (message.type === SW_MESSAGE.skipWaiting) {
		void self.skipWaiting();
		return;
	}
	autoUpdate = message.value;
});

self.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET') return;

	const url = new URL(event.request.url);
	if (url.origin !== self.location.origin) return;
	if (isRelayPath(url.pathname)) return;

	async function respond() {
		await prefReady;
		const cache = await caches.open(CACHE);
		const isAsset = ASSETS.includes(url.pathname);
		if (shouldServeCacheFirst({ autoUpdate, isAsset })) {
			const cached = (await cache.match(event.request)) ?? (await cache.match(url.pathname));
			if (cached) return cached;
		}

		try {
			const response = await fetch(event.request);

			if (!(response instanceof Response)) {
				throw new Error('invalid response from fetch');
			}

			if (response.status === 200 && !response.headers.get('cache-control')?.includes('no-store')) {
				await cache.put(event.request, response.clone());
			}

			return response;
		} catch (err) {
			const cached = (await cache.match(event.request)) ?? (await cache.match(url.pathname));
			if (cached) return cached;

			if (event.request.mode === 'navigate') {
				const shell = await cache.match('/');
				if (shell) return shell;
			}

			throw err;
		}
	}

	event.respondWith(respond());
});
