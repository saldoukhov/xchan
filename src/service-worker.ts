/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />
/// <reference types="@sveltejs/kit" />

import { build, files, version } from '$service-worker';

const self = globalThis.self as unknown as ServiceWorkerGlobalScope;

const CACHE = `xchan-${version}`;
const ASSETS = [...build, ...files];

function isRelayRequest(url: URL) {
	return url.pathname === '/api' || url.pathname.startsWith('/api/');
}

self.addEventListener('install', (event) => {
	async function addFilesToCache() {
		const cache = await caches.open(CACHE);
		await cache.addAll(ASSETS);
		await self.skipWaiting();
	}

	event.waitUntil(addFilesToCache());
});

self.addEventListener('activate', (event) => {
	async function deleteOldCaches() {
		for (const key of await caches.keys()) {
			if (key !== CACHE) await caches.delete(key);
		}
		await self.clients.claim();
	}

	event.waitUntil(deleteOldCaches());
});

self.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET') return;

	const url = new URL(event.request.url);
	if (url.origin !== self.location.origin) return;
	if (isRelayRequest(url)) return;

	async function respond() {
		const cache = await caches.open(CACHE);

		if (ASSETS.includes(url.pathname)) {
			const cached = await cache.match(url.pathname);
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
			const cached = await cache.match(event.request);
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
