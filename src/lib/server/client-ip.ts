import { isIPv4 } from 'node:net';

export function readClientIp(getClientAddress: () => string): string {
	try {
		return displayClientIp(getClientAddress());
	} catch {
		return '';
	}
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
