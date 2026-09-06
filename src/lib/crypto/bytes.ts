export function bytesToBase64(data: Uint8Array): string {
	const chunkSize = 0x8000;
	let binary = '';
	for (let i = 0; i < data.length; i += chunkSize) {
		binary += String.fromCharCode(...data.subarray(i, i + chunkSize));
	}
	return btoa(binary);
}

export function base64ToBytes(data: string): Uint8Array {
	return Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
}

export function isUncompressedP256(raw: Uint8Array): boolean {
	return raw.byteLength === 65 && raw[0] === 0x04;
}
