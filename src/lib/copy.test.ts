import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	copyLifeHash,
	copyWords,
	dataUrlToBlob,
	formatWordsForCopy,
	lifeHashCopyBlob,
	lifeHashFileName,
	shareIdentity
} from './copy';

const TINY_PNG =
	'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe('formatWordsForCopy', () => {
	it('numbers each word so a remote check can line up', () => {
		expect(formatWordsForCopy('abandon ability able')).toBe(' 1. abandon\n 2. ability\n 3. able');
	});

	it('ignores extra space and empty input', () => {
		expect(formatWordsForCopy('  abandon   ability  ')).toBe(' 1. abandon\n 2. ability');
		expect(formatWordsForCopy('   ')).toBe('');
	});

	it('keeps double-digit numbers aligned', () => {
		const words = Array.from({ length: 12 }, (_, i) => `w${i + 1}`).join(' ');
		const lines = formatWordsForCopy(words).split('\n');
		expect(lines[0]).toBe(' 1. w1');
		expect(lines[9]).toBe('10. w10');
		expect(lines[11]).toBe('12. w12');
	});
});

describe('lifeHashFileName', () => {
	it('slugs the card title', () => {
		expect(lifeHashFileName('Us')).toBe('xchan-us.png');
		expect(lifeHashFileName('Them')).toBe('xchan-them.png');
		expect(lifeHashFileName('  Us!!  ')).toBe('xchan-us.png');
	});

	it('falls back when the title is empty', () => {
		expect(lifeHashFileName('   ')).toBe('xchan-card.png');
	});
});

describe('dataUrlToBlob', () => {
	it('decodes a PNG data URL', async () => {
		const blob = dataUrlToBlob(TINY_PNG);
		expect(blob.type).toBe('image/png');
		expect(blob.size).toBeGreaterThan(0);
		expect(new Uint8Array(await blob.arrayBuffer())[0]).toBe(0x89);
	});

	it('rejects a non-data URL', () => {
		expect(() => dataUrlToBlob('https://example.test/hash.png')).toThrow('invalid data URL');
	});
});

describe('lifeHashCopyBlob', () => {
	it('returns the original PNG when canvas is unavailable', async () => {
		const blob = await lifeHashCopyBlob(TINY_PNG);
		expect(blob.type).toBe('image/png');
		expect(blob.size).toBe(dataUrlToBlob(TINY_PNG).size);
	});
});

describe('copyWords', () => {
	it('writes the numbered list to the clipboard', async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		vi.stubGlobal('navigator', { clipboard: { writeText } });
		await copyWords('abandon ability able');
		expect(writeText).toHaveBeenCalledWith(' 1. abandon\n 2. ability\n 3. able');
	});

	it('rejects when there are no words', async () => {
		await expect(copyWords('   ')).rejects.toThrow('no-words');
	});
});

describe('copyLifeHash', () => {
	it('writes a PNG to the clipboard when the image clipboard is available', async () => {
		const write = vi.fn().mockResolvedValue(undefined);
		vi.stubGlobal(
			'ClipboardItem',
			class ClipboardItem {
				constructor(public items: Record<string, Blob>) {}
			}
		);
		vi.stubGlobal('navigator', { clipboard: { write } });
		await expect(copyLifeHash(TINY_PNG, 'Us')).resolves.toBe('copied');
		expect(write).toHaveBeenCalledTimes(1);
		const items = write.mock.calls[0][0] as { items: Record<string, Blob> }[];
		expect(items[0].items['image/png'].type).toBe('image/png');
	});

	it('saves a PNG when the clipboard cannot take an image', async () => {
		const click = vi.fn();
		const remove = vi.fn();
		const append = vi.fn();
		vi.stubGlobal('document', {
			createElement: () => ({ href: '', download: '', rel: '', click, remove }),
			body: { append }
		});
		vi.stubGlobal('URL', {
			createObjectURL: () => 'blob:test',
			revokeObjectURL: vi.fn()
		});
		vi.stubGlobal('navigator', { clipboard: {} });
		await expect(copyLifeHash(TINY_PNG, 'Them')).resolves.toBe('saved');
		expect(click).toHaveBeenCalled();
		expect(append).toHaveBeenCalled();
	});
});

describe('shareIdentity', () => {
	it('shares the picture and words when the device can send files', async () => {
		const share = vi.fn().mockResolvedValue(undefined);
		vi.stubGlobal('navigator', {
			share,
			canShare: () => true
		});
		await expect(
			shareIdentity({ title: 'Us', words: 'abandon ability', lifeHash: TINY_PNG })
		).resolves.toBe(true);
		expect(share).toHaveBeenCalledTimes(1);
		const payload = share.mock.calls[0][0] as { title: string; text: string; files: File[] };
		expect(payload.title).toBe('XChan Us');
		expect(payload.text).toBe(' 1. abandon\n 2. ability');
		expect(payload.files[0].name).toBe('xchan-us.png');
	});

	it('returns false when the user cancels the share sheet', async () => {
		const err = new Error('canceled');
		err.name = 'AbortError';
		vi.stubGlobal('navigator', {
			share: vi.fn().mockRejectedValue(err),
			canShare: () => true
		});
		await expect(
			shareIdentity({ title: 'Us', words: 'abandon', lifeHash: TINY_PNG })
		).resolves.toBe(false);
	});
});
