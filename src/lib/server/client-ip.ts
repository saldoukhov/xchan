import { isIPv4, isIPv6 } from 'node:net';

export function readClientIp(getClientAddress: () => string, headers?: Headers): string {
	const fromHeaders = forwardedClientIp(headers);
	if (fromHeaders) return fromHeaders;
	try {
		return displayClientIp(getClientAddress());
	} catch {
		return '';
	}
}

export function forwardedClientIp(headers?: Headers): string {
	if (!headers) return '';
	const fromXff = firstPublicIp(headers.get('x-forwarded-for'));
	if (fromXff) return fromXff;
	const fastly = publicCandidate(headers.get('fastly-client-ip'));
	if (fastly) return fastly;
	return publicCandidate(headers.get('x-real-ip'));
}

export function displayClientIp(ip: string): string {
	const trimmed = ip.trim();
	if (!trimmed) return '';
	if (trimmed.toLowerCase().startsWith('::ffff:')) {
		const mapped = trimmed.slice('::ffff:'.length);
		if (isIPv4(mapped)) return mapped;
	}
	return trimmed;
}

function firstPublicIp(header: string | null): string {
	if (!header) return '';
	for (const part of header.split(',')) {
		const ip = publicCandidate(part);
		if (ip) return ip;
	}
	return '';
}

function publicCandidate(value: string | null): string {
	const ip = normalizeCandidate(value ?? '');
	return ip && isPublicIp(ip) ? ip : '';
}

function normalizeCandidate(value: string): string {
	let token = value.trim();
	if (!token) return '';
	if (token.startsWith('"') && token.endsWith('"') && token.length >= 2) {
		token = token.slice(1, -1).trim();
	}
	if (token.startsWith('[')) {
		const end = token.indexOf(']');
		if (end !== -1) token = token.slice(1, end);
	} else {
		const colon = token.lastIndexOf(':');
		if (colon !== -1 && token.includes('.')) token = token.slice(0, colon);
	}
	const ip = displayClientIp(token);
	if (!ip) return '';
	if (isIPv4(ip) || isIPv6(ip)) return ip;
	return '';
}

export function isPublicIp(ip: string): boolean {
	const displayed = displayClientIp(ip);
	if (isIPv4(displayed)) return !isPrivateIpv4(displayed);
	if (isIPv6(displayed)) return !isPrivateIpv6(displayed);
	return false;
}

function isPrivateIpv4(ip: string): boolean {
	const octets = ip.split('.').map(Number);
	const a = octets[0];
	const b = octets[1];
	if (a === 0 || a === 10 || a === 127) return true;
	if (a === 169 && b === 254) return true;
	if (a === 172 && b >= 16 && b <= 31) return true;
	if (a === 192 && b === 168) return true;
	if (a === 100 && b >= 64 && b <= 127) return true;
	return false;
}

function isPrivateIpv6(ip: string): boolean {
	const lower = ip.toLowerCase();
	if (lower === '::' || lower === '::1') return true;
	const first = lower.split(':')[0] || '0';
	const n = Number.parseInt(first, 16);
	if (Number.isNaN(n)) return true;
	if ((n & 0xfe00) === 0xfc00) return true;
	if ((n & 0xffc0) === 0xfe80) return true;
	return false;
}
