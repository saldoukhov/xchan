import { describe, expect, it } from 'vitest';
import { decrypt, encrypt } from './crypto/ecies';
import {
	CHUNK_DATA_BYTES,
	FileAssembler,
	MAX_CIPHERTEXT_BYTES,
	MAX_FILE_BYTES,
	MAX_FILENAME_BYTES,
	MAX_PLAINTEXT_BYTES,
	PayloadTooLargeError,
	FileUnreadableError,
	attachLocalFile,
	chunkByteLength,
	chunkCount,
	decodePayload,
	encodePayload,
	fileBlob,
	formatBytes,
	isPreviewableImage,
	newTransferId,
	readFileChunk,
	sanitizeFilename,
	sanitizeMime
} from './payload';

describe('sanitizeFilename', () => {
	it('keeps a plain name', () => {
		expect(sanitizeFilename('notes.txt')).toBe('notes.txt');
	});

	it('strips path components and control characters', () => {
		expect(sanitizeFilename('../../etc/passwd')).toBe('passwd');
		expect(sanitizeFilename('C:\\secrets\\id_ed25519')).toBe('id_ed25519');
		expect(sanitizeFilename('bad\nname.txt')).toBe('badname.txt');
	});

	it('falls back when the name is empty after cleaning', () => {
		expect(sanitizeFilename('')).toBe('file');
		expect(sanitizeFilename('...')).toBe('file');
		expect(sanitizeFilename('   ')).toBe('file');
	});

	it('truncates a long name', () => {
		const name = `${'a'.repeat(MAX_FILENAME_BYTES + 40)}.txt`;
		const cleaned = sanitizeFilename(name);
		expect(new TextEncoder().encode(cleaned).byteLength).toBeLessThanOrEqual(MAX_FILENAME_BYTES);
		expect(cleaned.length).toBeGreaterThan(0);
	});
});

describe('sanitizeMime', () => {
	it('accepts a normal type and rejects junk', () => {
		expect(sanitizeMime('image/png')).toBe('image/png');
		expect(sanitizeMime('IMAGE/JPEG')).toBe('image/jpeg');
		expect(sanitizeMime('text/plain; charset=utf-8')).toBe('application/octet-stream');
		expect(sanitizeMime('')).toBe('application/octet-stream');
	});
});

describe('encodePayload / decodePayload', () => {
	it('round-trips text as raw UTF-8', () => {
		const encoded = encodePayload({ kind: 'text', text: 'hunter2' });
		expect(encoded).toEqual(new TextEncoder().encode('hunter2'));
		expect(decodePayload(encoded)).toEqual({ kind: 'text', text: 'hunter2' });
	});

	it('decodes a 0x00-prefixed text payload', () => {
		expect(decodePayload(new Uint8Array([0, ...new TextEncoder().encode('hunter2')]))).toEqual({
			kind: 'text',
			text: 'hunter2'
		});
	});

	it('round-trips a legacy single-message file', () => {
		const bytes = new Uint8Array([0, 1, 2, 255, 10]);
		const encoded = encodePayload({
			kind: 'file',
			name: 'ключ.txt',
			type: 'application/octet-stream',
			bytes
		});
		const decoded = decodePayload(encoded);
		expect(decoded).toEqual({
			kind: 'file',
			name: 'ключ.txt',
			type: 'application/octet-stream',
			bytes
		});
	});

	it('round-trips a file chunk', () => {
		const bytes = new Uint8Array([9, 8, 7]);
		const id = newTransferId();
		const encoded = encodePayload({
			kind: 'file-chunk',
			id,
			index: 0,
			total: 1,
			fileSize: 3,
			name: 'ключ.bin',
			type: 'application/octet-stream',
			bytes
		});
		expect(decodePayload(encoded)).toEqual({
			kind: 'file-chunk',
			id,
			index: 0,
			total: 1,
			fileSize: 3,
			name: 'ключ.bin',
			type: 'application/octet-stream',
			bytes
		});
	});

	it('decodes legacy raw UTF-8 as text', () => {
		expect(decodePayload(new TextEncoder().encode('hunter2'))).toEqual({
			kind: 'text',
			text: 'hunter2'
		});
	});

	it('treats an empty plaintext as empty text', () => {
		expect(decodePayload(new Uint8Array())).toEqual({ kind: 'text', text: '' });
	});

	it('rejects a truncated file header', () => {
		expect(() => decodePayload(new Uint8Array([0x01, 0, 10]))).toThrow('invalid payload');
	});

	it('keeps a max-size chunk under the ciphertext budget', () => {
		const bytes = new Uint8Array(CHUNK_DATA_BYTES);
		const encoded = encodePayload({
			kind: 'file-chunk',
			id: new Uint8Array(16),
			index: 0,
			total: chunkCount(MAX_FILE_BYTES),
			fileSize: MAX_FILE_BYTES,
			name: 'a'.repeat(MAX_FILENAME_BYTES),
			type: 'application/octet-stream',
			bytes
		});
		expect(encoded.byteLength).toBeLessThanOrEqual(MAX_PLAINTEXT_BYTES);
		const ciphertextBytes = encoded.byteLength + 65 + 12 + 16;
		expect(ciphertextBytes).toBeLessThanOrEqual(MAX_CIPHERTEXT_BYTES);
		const jsonBytes = 4 * Math.ceil(ciphertextBytes / 3) + 256;
		expect(jsonBytes).toBeLessThan(512 * 1024);
	});

	it('encrypts a file chunk the peer can decrypt under the ciphertext cap', async () => {
		const recipient = await crypto.subtle.generateKey(
			{ name: 'ECDH', namedCurve: 'P-256' },
			false,
			['deriveBits']
		);
		const raw = new Uint8Array(await crypto.subtle.exportKey('raw', recipient.publicKey));
		const payload = {
			kind: 'file-chunk' as const,
			id: newTransferId(),
			index: 0,
			total: 1,
			fileSize: 4,
			name: 'id_ed25519',
			type: 'application/octet-stream',
			bytes: new Uint8Array([1, 2, 3, 4])
		};
		const ciphertext = await encrypt(encodePayload(payload), raw);
		expect(ciphertext.byteLength).toBeLessThanOrEqual(MAX_CIPHERTEXT_BYTES);
		expect(decodePayload(await decrypt(ciphertext, recipient.privateKey))).toEqual(payload);
	});
});

describe('chunking', () => {
	it('splits a file across full-size chunks and a remainder', () => {
		const size = CHUNK_DATA_BYTES + 10;
		expect(chunkCount(size)).toBe(2);
		expect(chunkByteLength(size, 0)).toBe(CHUNK_DATA_BYTES);
		expect(chunkByteLength(size, 1)).toBe(10);
		expect(chunkCount(0)).toBe(1);
		expect(chunkByteLength(0, 0)).toBe(0);
	});

	it('reads a File in slices without loading the rest', async () => {
		const size = CHUNK_DATA_BYTES + 4;
		const data = new Uint8Array(size);
		data[0] = 11;
		data[CHUNK_DATA_BYTES] = 22;
		data[size - 1] = 33;
		const file = new File([data], 'clip.bin');
		const first = await readFileChunk(file, 0);
		const second = await readFileChunk(file, 1);
		expect(first.byteLength).toBe(CHUNK_DATA_BYTES);
		expect(first[0]).toBe(11);
		expect(second).toEqual(new Uint8Array([22, 0, 0, 33]));
	});
});

describe('FileAssembler', () => {
	it('reassembles out-of-order chunks into the original file', () => {
		const fileSize = CHUNK_DATA_BYTES + 3;
		const first = new Uint8Array(CHUNK_DATA_BYTES);
		first[0] = 7;
		const second = new Uint8Array([1, 2, 3]);
		const id = newTransferId();
		const assembler = new FileAssembler();
		expect(
			assembler.add({
				kind: 'file-chunk',
				id,
				index: 1,
				total: 2,
				fileSize,
				name: 'clip.bin',
				type: 'application/octet-stream',
				bytes: second
			})
		).toBeNull();
		expect(assembler.receivedBytes).toBe(3);
		const done = assembler.add({
			kind: 'file-chunk',
			id,
			index: 0,
			total: 2,
			fileSize,
			name: 'clip.bin',
			type: 'application/octet-stream',
			bytes: first
		});
		expect(done?.kind).toBe('file');
		expect(done?.name).toBe('clip.bin');
		expect(done?.bytes.byteLength).toBe(fileSize);
		expect(done?.bytes[0]).toBe(7);
		expect(done?.bytes.slice(-3)).toEqual(second);
	});

	it('starts a new transfer when the id changes', () => {
		const assembler = new FileAssembler();
		assembler.add({
			kind: 'file-chunk',
			id: newTransferId(),
			index: 0,
			total: 1,
			fileSize: 1,
			name: 'a.bin',
			type: 'application/octet-stream',
			bytes: new Uint8Array([1])
		});
		const second = assembler.add({
			kind: 'file-chunk',
			id: newTransferId(),
			index: 0,
			total: 1,
			fileSize: 1,
			name: 'b.bin',
			type: 'application/octet-stream',
			bytes: new Uint8Array([2])
		});
		expect(second).toEqual({
			kind: 'file',
			name: 'b.bin',
			type: 'application/octet-stream',
			bytes: new Uint8Array([2])
		});
	});

	it('rejects a transfer over the file cap', () => {
		const assembler = new FileAssembler();
		expect(() =>
			assembler.add({
				kind: 'file-chunk',
				id: newTransferId(),
				index: 0,
				total: chunkCount(MAX_FILE_BYTES + 1),
				fileSize: MAX_FILE_BYTES + 1,
				name: 'big.bin',
				type: 'application/octet-stream',
				bytes: new Uint8Array()
			})
		).toThrow(PayloadTooLargeError);
	});
});

describe('attachLocalFile', () => {
	it('copies file bytes so later reads do not need the original handle', async () => {
		const file = new File([new Uint8Array([9, 8, 7])], 'key.pem', {
			type: 'application/x-pem-file'
		});
		const attached = await attachLocalFile(file);
		expect(attached.name).toBe('key.pem');
		expect(attached.type).toBe('application/x-pem-file');
		expect(attached.size).toBe(3);
		expect(attached.file).not.toBe(file);
		expect(new Uint8Array(await attached.file.arrayBuffer())).toEqual(new Uint8Array([9, 8, 7]));
	});

	it('rejects a file over the cap without reading it', async () => {
		const file = {
			name: 'big.bin',
			type: '',
			size: MAX_FILE_BYTES + 1
		} as File;
		await expect(attachLocalFile(file)).rejects.toBeInstanceOf(PayloadTooLargeError);
	});

	it('throws when the picker file cannot be read', async () => {
		const file = {
			name: 'icloud.bin',
			type: '',
			size: 4,
			lastModified: 0,
			slice() {
				return {
					arrayBuffer() {
						return Promise.reject(new Error('NotReadableError'));
					}
				};
			}
		} as unknown as File;
		await expect(attachLocalFile(file)).rejects.toBeInstanceOf(FileUnreadableError);
	});
});

describe('formatBytes', () => {
	it('formats byte sizes for the UI', () => {
		expect(formatBytes(0)).toBe('0 B');
		expect(formatBytes(512)).toBe('512 B');
		expect(formatBytes(2048)).toBe('2.0 KB');
		expect(formatBytes(12 * 1024)).toBe('12 KB');
		expect(formatBytes(MAX_FILE_BYTES)).toBe('50 MB');
	});
});

describe('fileBlob', () => {
	it('builds a downloadable blob with the file type', () => {
		const blob = fileBlob({
			kind: 'file',
			name: 'a.png',
			type: 'image/png',
			bytes: new Uint8Array([1, 2, 3])
		});
		expect(blob.type).toBe('image/png');
		expect(blob.size).toBe(3);
	});
});

describe('isPreviewableImage', () => {
	it('allows common raster types and not SVG', () => {
		expect(isPreviewableImage('image/png')).toBe(true);
		expect(isPreviewableImage('image/svg+xml')).toBe(false);
		expect(isPreviewableImage('application/pdf')).toBe(false);
	});
});
