import { isIPv4, isIPv6 } from 'node:net';

export const JOIN_WINDOW_MS = 60_000;
export const JOIN_MAX = 4;
export const JOIN_MAX_UNKNOWN = 2;
export const MATCH_WINDOW_MS = 10 * 60_000;
export const MATCH_MAX = 2;
export const MATCH_MAX_UNKNOWN = 1;
export const MAX_CONCURRENT_PER_IP = 2;
export const MAX_QUEUE = 8;
export const GLOBAL_MATCH_WINDOW_MS = 60_000;
export const GLOBAL_MATCH_MAX = 4;
export const PENDING_ADMIT_MS = 10_000;

const UNKNOWN_KEY = 'unknown';

export function pairingLimitKey(ip: string): string {
	const trimmed = ip.trim().toLowerCase();
	if (!trimmed) return UNKNOWN_KEY;

	if (trimmed.startsWith('::ffff:')) {
		const mapped = trimmed.slice('::ffff:'.length);
		if (isIPv4(mapped)) return mapped;
	}

	if (isIPv4(trimmed)) return trimmed;

	if (isIPv6(trimmed)) {
		const groups = expandIpv6(trimmed);
		if (!groups) return UNKNOWN_KEY;
		const ipv4 = ipv4FromMapped(groups);
		if (ipv4) return ipv4;
		return `${groups.slice(0, 4).join(':')}/64`;
	}

	return UNKNOWN_KEY;
}

export function isUnknownLimitKey(key: string): boolean {
	return key === UNKNOWN_KEY;
}

function expandIpv6(address: string): string[] | null {
	let ip = address;
	const zone = ip.indexOf('%');
	if (zone !== -1) ip = ip.slice(0, zone);

	if (ip.includes('.')) {
		const lastColon = ip.lastIndexOf(':');
		if (lastColon === -1) return null;
		const v4 = ip.slice(lastColon + 1);
		if (!isIPv4(v4)) return null;
		const octets = v4.split('.').map(Number);
		ip = `${ip.slice(0, lastColon)}:${((octets[0] << 8) | octets[1]).toString(16)}:${((octets[2] << 8) | octets[3]).toString(16)}`;
	}

	const halves = ip.split('::');
	if (halves.length > 2) return null;

	const left = halves[0] ? halves[0].split(':') : [];
	const right = halves.length === 2 ? (halves[1] ? halves[1].split(':') : []) : [];
	if (left.some((g) => g.length === 0) || right.some((g) => g.length === 0)) return null;

	let groups: string[];
	if (halves.length === 1) {
		if (left.length !== 8) return null;
		groups = left;
	} else {
		const fill = 8 - left.length - right.length;
		if (fill < 0) return null;
		groups = [...left, ...Array(fill).fill('0'), ...right];
	}

	if (groups.length !== 8) return null;
	if (groups.some((g) => !/^[0-9a-f]{1,4}$/.test(g))) return null;
	return groups.map((g) => g.padStart(4, '0'));
}

function ipv4FromMapped(groups: string[]): string | null {
	const words = groups.map((g) => Number.parseInt(g, 16));
	const mapped =
		words[0] === 0 &&
		words[1] === 0 &&
		words[2] === 0 &&
		words[3] === 0 &&
		words[4] === 0 &&
		words[5] === 0xffff;
	if (!mapped) return null;
	return `${words[6] >> 8}.${words[6] & 0xff}.${words[7] >> 8}.${words[7] & 0xff}`;
}

function prune(times: number[], now: number, windowMs: number): number[] {
	const cutoff = now - windowMs;
	let i = 0;
	while (i < times.length && times[i] <= cutoff) i += 1;
	return i === 0 ? times : times.slice(i);
}

function retryAfterSec(times: number[], windowMs: number, max: number, now: number): number | null {
	const pruned = prune(times, now, windowMs);
	if (pruned.length < max) return null;
	const oldest = pruned[pruned.length - max];
	return Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
}

export class PairLimiter {
	private joins = new Map<string, number[]>();
	private matches = new Map<string, number[]>();
	private globalMatches: number[] = [];

	recordJoin(key: string, now: number): void {
		this.joins.set(key, [...prune(this.joins.get(key) ?? [], now, JOIN_WINDOW_MS), now]);
	}

	recordMatch(key: string, now: number): void {
		this.matches.set(key, [...prune(this.matches.get(key) ?? [], now, MATCH_WINDOW_MS), now]);
	}

	recordGlobalMatch(now: number): void {
		this.globalMatches = [...prune(this.globalMatches, now, GLOBAL_MATCH_WINDOW_MS), now];
	}

	joinRetryAfter(key: string, now: number): number | null {
		const max = isUnknownLimitKey(key) ? JOIN_MAX_UNKNOWN : JOIN_MAX;
		return retryAfterSec(this.joins.get(key) ?? [], JOIN_WINDOW_MS, max, now);
	}

	matchRetryAfter(key: string, now: number): number | null {
		const max = isUnknownLimitKey(key) ? MATCH_MAX_UNKNOWN : MATCH_MAX;
		return retryAfterSec(this.matches.get(key) ?? [], MATCH_WINDOW_MS, max, now);
	}

	globalMatchRetryAfter(now: number): number | null {
		return retryAfterSec(this.globalMatches, GLOBAL_MATCH_WINDOW_MS, GLOBAL_MATCH_MAX, now);
	}

	reset(): void {
		this.joins.clear();
		this.matches.clear();
		this.globalMatches = [];
	}
}
