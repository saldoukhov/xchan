import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { bytesToBase64 } from '$lib/crypto/bytes';
import { JOIN_MAX } from '$lib/server/pair-limit';
import {
	cancelPairing,
	joinPairing,
	resetRelayForTests,
	setRelayNowForTests
} from '$lib/server/relay';
import type { SseSink } from '$lib/server/sse';
import type { RequestHandler } from './$types';
import { GET } from './+server';

function commitId(n: number): string {
	const raw = new Uint8Array(32);
	raw[0] = n;
	return bytesToBase64(raw);
}

function pub(n: number): string {
	const raw = new Uint8Array(65);
	raw[0] = 0x04;
	raw[1] = n;
	return bytesToBase64(raw);
}

function event(commit: string, ip: string): Parameters<RequestHandler>[0] {
	const url = new URL('http://localhost/api/pair/events');
	url.searchParams.set('commit', commit);
	url.searchParams.set('identityPublicKey', pub(1));
	return {
		url,
		request: new Request(url, { headers: { Accept: 'text/event-stream' } }),
		getClientAddress: () => ip
	} as Parameters<RequestHandler>[0];
}

beforeEach(() => {
	resetRelayForTests();
	setRelayNowForTests(1_000_000);
});

afterEach(() => {
	resetRelayForTests();
});

function sink(): SseSink {
	return {
		send() {},
		close() {}
	};
}

describe('GET /api/pair/events', () => {
	it('returns 429 with Retry-After before opening SSE when joins are exhausted', async () => {
		for (let i = 1; i <= JOIN_MAX; i += 1) {
			joinPairing(commitId(i), pub(i), '192.0.2.1', sink());
			cancelPairing(commitId(i));
		}
		const blocked = await GET(event(commitId(9), '192.0.2.1'));
		expect(blocked.status).toBe(429);
		expect(blocked.headers.get('Retry-After')).toBeTruthy();
		expect(blocked.headers.get('Content-Type')).toContain('text/plain');
		expect(await blocked.text()).toContain('Too many pairing attempts');
	});

	it('opens SSE for an admitted waiter', async () => {
		const response = await GET(event(commitId(1), '192.0.2.1'));
		expect(response.status).toBe(200);
		expect(response.headers.get('Content-Type')).toBe('text/event-stream');
		void response.body?.cancel();
	});
});
