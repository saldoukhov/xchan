export const MAX_FILE_BYTES = 50 * 1024 * 1024;
export const CHUNK_DATA_BYTES = 512 * 1024;
export const MAX_FILENAME_BYTES = 180;
export const MAX_MIME_BYTES = 127;
const TRANSFER_ID_LEN = 16;
const FILE_HEADER_BYTES = 5;
const CHUNK_HEADER_MAX =
	1 + TRANSFER_ID_LEN + 4 + 4 + 4 + 2 + MAX_FILENAME_BYTES + 2 + MAX_MIME_BYTES;
export const MAX_PLAINTEXT_BYTES = CHUNK_HEADER_MAX + CHUNK_DATA_BYTES;
export const MAX_CIPHERTEXT_BYTES = 1024 * 1024;

const KIND_TEXT = 0x00;
const KIND_FILE = 0x01;
const KIND_FILE_CHUNK = 0x02;

const PREVIEWABLE_IMAGE_TYPES = new Set([
	'image/jpeg',
	'image/png',
	'image/gif',
	'image/webp',
	'image/avif'
]);

export type TextPayload = { kind: 'text'; text: string };
export type FilePayload = { kind: 'file'; name: string; type: string; bytes: Uint8Array };
export type FileChunkPayload = {
	kind: 'file-chunk';
	id: Uint8Array;
	index: number;
	total: number;
	fileSize: number;
	name: string;
	type: string;
	bytes: Uint8Array;
};
export type Payload = TextPayload | FilePayload | FileChunkPayload;

export type AttachedFile = {
	name: string;
	type: string;
	size: number;
	file: File;
};

export class PayloadTooLargeError extends Error {
	constructor() {
		super(`This file is too large (max ${formatBytes(MAX_FILE_BYTES)}).`);
		this.name = 'PayloadTooLargeError';
	}
}

export class InvalidPayloadError extends Error {
	constructor() {
		super('invalid payload');
		this.name = 'InvalidPayloadError';
	}
}

function utf8Truncate(value: string, maxBytes: number): string {
	const encoder = new TextEncoder();
	if (encoder.encode(value).byteLength <= maxBytes) return value;
	let out = '';
	let used = 0;
	for (const ch of value) {
		const n = encoder.encode(ch).byteLength;
		if (used + n > maxBytes) break;
		out += ch;
		used += n;
	}
	return out;
}

export function sanitizeFilename(name: string | null | undefined): string {
	const base = (name ?? '').replace(/\\/g, '/').split('/').pop() ?? '';
	const cleaned = [...base]
		.filter((ch) => ch >= ' ' && ch !== '\u007f')
		.join('')
		.replace(/[. ]+$/g, '');
	return utf8Truncate(cleaned, MAX_FILENAME_BYTES) || 'file';
}

export function sanitizeMime(type: string | null | undefined): string {
	const t = (type ?? '').trim().toLowerCase();
	if (
		t.length > 0 &&
		t.length <= MAX_MIME_BYTES &&
		/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(t)
	) {
		return t;
	}
	return 'application/octet-stream';
}

export function isPreviewableImage(type: string): boolean {
	return PREVIEWABLE_IMAGE_TYPES.has(type);
}

export function formatBytes(n: number): string {
	if (n < 1024) return `${n} B`;
	const kb = n / 1024;
	if (kb < 1024) return kb >= 10 ? `${Math.round(kb)} KB` : `${kb.toFixed(1)} KB`;
	const mb = kb / 1024;
	return mb >= 10 ? `${Math.round(mb)} MB` : `${mb.toFixed(1)} MB`;
}

function writeU16(buf: Uint8Array, offset: number, value: number): void {
	buf[offset] = (value >> 8) & 0xff;
	buf[offset + 1] = value & 0xff;
}

function readU16(buf: Uint8Array, offset: number): number {
	return ((buf[offset] ?? 0) << 8) | (buf[offset + 1] ?? 0);
}

function writeU32(buf: Uint8Array, offset: number, value: number): void {
	buf[offset] = (value >>> 24) & 0xff;
	buf[offset + 1] = (value >>> 16) & 0xff;
	buf[offset + 2] = (value >>> 8) & 0xff;
	buf[offset + 3] = value & 0xff;
}

function readU32(buf: Uint8Array, offset: number): number {
	return (
		(((buf[offset] ?? 0) << 24) |
			((buf[offset + 1] ?? 0) << 16) |
			((buf[offset + 2] ?? 0) << 8) |
			(buf[offset + 3] ?? 0)) >>>
		0
	);
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
	if (a.byteLength !== b.byteLength) return false;
	let diff = 0;
	for (let i = 0; i < a.byteLength; i += 1) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
	return diff === 0;
}

export function newTransferId(): Uint8Array {
	return crypto.getRandomValues(new Uint8Array(TRANSFER_ID_LEN));
}

export function chunkCount(fileSize: number): number {
	return Math.max(1, Math.ceil(fileSize / CHUNK_DATA_BYTES));
}

export function chunkByteLength(fileSize: number, index: number): number {
	const total = chunkCount(fileSize);
	if (index < 0 || index >= total) return 0;
	if (fileSize === 0) return 0;
	if (index === total - 1) return fileSize - index * CHUNK_DATA_BYTES;
	return CHUNK_DATA_BYTES;
}

export function attachLocalFile(file: File): AttachedFile {
	if (file.size > MAX_FILE_BYTES) throw new PayloadTooLargeError();
	return {
		name: sanitizeFilename(file.name),
		type: sanitizeMime(file.type),
		size: file.size,
		file
	};
}

export async function readFileChunk(file: File, index: number): Promise<Uint8Array> {
	const start = index * CHUNK_DATA_BYTES;
	const end = Math.min(start + CHUNK_DATA_BYTES, file.size);
	if (start > file.size || (start === file.size && file.size > 0)) {
		throw new InvalidPayloadError();
	}
	return new Uint8Array(await file.slice(start, end).arrayBuffer());
}

export function encodePayload(payload: Payload): Uint8Array {
	if (payload.kind === 'text') {
		// Raw UTF-8 so older clients still display a password as text.
		return new TextEncoder().encode(payload.text);
	}
	if (payload.kind === 'file-chunk') {
		return encodeFileChunk(payload);
	}
	const name = new TextEncoder().encode(sanitizeFilename(payload.name));
	const type = new TextEncoder().encode(sanitizeMime(payload.type));
	const out = new Uint8Array(
		FILE_HEADER_BYTES + name.byteLength + type.byteLength + payload.bytes.byteLength
	);
	out[0] = KIND_FILE;
	writeU16(out, 1, name.byteLength);
	out.set(name, 3);
	writeU16(out, 3 + name.byteLength, type.byteLength);
	out.set(type, 5 + name.byteLength);
	out.set(payload.bytes, 5 + name.byteLength + type.byteLength);
	return out;
}

function encodeFileChunk(chunk: FileChunkPayload): Uint8Array {
	const name = new TextEncoder().encode(sanitizeFilename(chunk.name));
	const type = new TextEncoder().encode(sanitizeMime(chunk.type));
	const id =
		chunk.id.byteLength === TRANSFER_ID_LEN ? chunk.id : chunk.id.slice(0, TRANSFER_ID_LEN);
	const header = 1 + TRANSFER_ID_LEN + 4 + 4 + 4 + 2 + name.byteLength + 2 + type.byteLength;
	const out = new Uint8Array(header + chunk.bytes.byteLength);
	let offset = 0;
	out[offset] = KIND_FILE_CHUNK;
	offset += 1;
	out.set(id, offset);
	offset += TRANSFER_ID_LEN;
	writeU32(out, offset, chunk.index);
	offset += 4;
	writeU32(out, offset, chunk.total);
	offset += 4;
	writeU32(out, offset, chunk.fileSize);
	offset += 4;
	writeU16(out, offset, name.byteLength);
	offset += 2;
	out.set(name, offset);
	offset += name.byteLength;
	writeU16(out, offset, type.byteLength);
	offset += 2;
	out.set(type, offset);
	offset += type.byteLength;
	out.set(chunk.bytes, offset);
	return out;
}

export function decodePayload(plain: Uint8Array): Payload {
	if (plain.byteLength === 0) return { kind: 'text', text: '' };
	const kind = plain[0];
	if (kind === KIND_TEXT) {
		return { kind: 'text', text: new TextDecoder().decode(plain.subarray(1)) };
	}
	if (kind === KIND_FILE_CHUNK) {
		return decodeFileChunk(plain);
	}
	if (kind !== KIND_FILE) {
		return { kind: 'text', text: new TextDecoder().decode(plain) };
	}
	if (plain.byteLength < FILE_HEADER_BYTES) throw new InvalidPayloadError();
	let offset = 1;
	const nameLen = readU16(plain, offset);
	offset += 2;
	if (offset + nameLen + 2 > plain.byteLength) throw new InvalidPayloadError();
	const name = sanitizeFilename(new TextDecoder().decode(plain.subarray(offset, offset + nameLen)));
	offset += nameLen;
	const typeLen = readU16(plain, offset);
	offset += 2;
	if (offset + typeLen > plain.byteLength) throw new InvalidPayloadError();
	const type = sanitizeMime(new TextDecoder().decode(plain.subarray(offset, offset + typeLen)));
	offset += typeLen;
	return { kind: 'file', name, type, bytes: plain.slice(offset) };
}

function decodeFileChunk(plain: Uint8Array): FileChunkPayload {
	const min = 1 + TRANSFER_ID_LEN + 4 + 4 + 4 + 2 + 2;
	if (plain.byteLength < min) throw new InvalidPayloadError();
	let offset = 1;
	const id = plain.slice(offset, offset + TRANSFER_ID_LEN);
	offset += TRANSFER_ID_LEN;
	const index = readU32(plain, offset);
	offset += 4;
	const total = readU32(plain, offset);
	offset += 4;
	const fileSize = readU32(plain, offset);
	offset += 4;
	const nameLen = readU16(plain, offset);
	offset += 2;
	if (offset + nameLen + 2 > plain.byteLength) throw new InvalidPayloadError();
	const name = sanitizeFilename(new TextDecoder().decode(plain.subarray(offset, offset + nameLen)));
	offset += nameLen;
	const typeLen = readU16(plain, offset);
	offset += 2;
	if (offset + typeLen > plain.byteLength) throw new InvalidPayloadError();
	const type = sanitizeMime(new TextDecoder().decode(plain.subarray(offset, offset + typeLen)));
	offset += typeLen;
	return {
		kind: 'file-chunk',
		id,
		index,
		total,
		fileSize,
		name,
		type,
		bytes: plain.slice(offset)
	};
}

export function fileBlob(file: FilePayload): Blob {
	const copy = new Uint8Array(file.bytes.byteLength);
	copy.set(file.bytes);
	return new Blob([copy], { type: file.type || 'application/octet-stream' });
}

export class FileAssembler {
	name = '';
	type = '';
	fileSize = 0;
	total = 0;
	receivedChunks = 0;
	private id: Uint8Array | null = null;
	private parts: (Uint8Array | undefined)[] = [];

	get receivedBytes(): number {
		let n = 0;
		for (const part of this.parts) {
			if (part) n += part.byteLength;
		}
		return n;
	}

	get active(): boolean {
		return this.id !== null;
	}

	reset(): void {
		this.id = null;
		this.name = '';
		this.type = '';
		this.fileSize = 0;
		this.total = 0;
		this.receivedChunks = 0;
		this.parts = [];
	}

	add(chunk: FileChunkPayload): FilePayload | null {
		if (chunk.fileSize > MAX_FILE_BYTES) throw new PayloadTooLargeError();
		if (chunk.total !== chunkCount(chunk.fileSize)) throw new InvalidPayloadError();
		if (chunk.index < 0 || chunk.index >= chunk.total) throw new InvalidPayloadError();
		if (chunk.id.byteLength !== TRANSFER_ID_LEN) throw new InvalidPayloadError();
		if (chunk.bytes.byteLength !== chunkByteLength(chunk.fileSize, chunk.index)) {
			throw new InvalidPayloadError();
		}
		if (!this.id || !bytesEqual(this.id, chunk.id)) {
			this.id = chunk.id;
			this.name = sanitizeFilename(chunk.name);
			this.type = sanitizeMime(chunk.type);
			this.fileSize = chunk.fileSize;
			this.total = chunk.total;
			this.receivedChunks = 0;
			this.parts = Array.from({ length: chunk.total });
		} else if (chunk.fileSize !== this.fileSize || chunk.total !== this.total) {
			throw new InvalidPayloadError();
		}
		if (!this.parts[chunk.index]) {
			this.parts[chunk.index] = chunk.bytes;
			this.receivedChunks += 1;
		}
		if (this.receivedChunks !== this.total) return null;
		const bytes = new Uint8Array(this.fileSize);
		let offset = 0;
		for (const part of this.parts) {
			if (!part) throw new InvalidPayloadError();
			bytes.set(part, offset);
			offset += part.byteLength;
		}
		const file: FilePayload = { kind: 'file', name: this.name, type: this.type, bytes };
		this.reset();
		return file;
	}
}
