export const LIFEHASH_COPY_SCALE = 8;

export function formatWordsForCopy(words: string): string {
	return words
		.trim()
		.split(/\s+/)
		.filter(Boolean)
		.map((word, i) => `${String(i + 1).padStart(2, ' ')}. ${word}`)
		.join('\n');
}

export function lifeHashFileName(title: string): string {
	const slug = title
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
	return `xchan-${slug || 'card'}.png`;
}

export function dataUrlToBlob(dataUrl: string): Blob {
	const comma = dataUrl.indexOf(',');
	if (!dataUrl.startsWith('data:') || comma < 0) {
		throw new Error('invalid data URL');
	}
	const header = dataUrl.slice(5, comma);
	const mime = header.split(';')[0] || 'application/octet-stream';
	const payload = dataUrl.slice(comma + 1);
	const bytes = header.includes('base64')
		? Uint8Array.from(atob(payload), (c) => c.charCodeAt(0))
		: new TextEncoder().encode(decodeURIComponent(payload));
	return new Blob([bytes], { type: mime });
}

export async function lifeHashCopyBlob(dataUrl: string): Promise<Blob> {
	const original = dataUrlToBlob(dataUrl);
	if (typeof Image === 'undefined' || typeof document === 'undefined') return original;

	try {
		const img = new Image();
		img.src = dataUrl;
		await img.decode();
		const canvas = document.createElement('canvas');
		canvas.width = Math.max(1, img.width * LIFEHASH_COPY_SCALE);
		canvas.height = Math.max(1, img.height * LIFEHASH_COPY_SCALE);
		const ctx = canvas.getContext('2d');
		if (!ctx) return original;
		ctx.imageSmoothingEnabled = false;
		ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
		const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
		return blob ?? original;
	} catch {
		return original;
	}
}

export async function copyWords(words: string): Promise<void> {
	const text = formatWordsForCopy(words);
	if (!text) throw new Error('no-words');
	try {
		if (!navigator.clipboard?.writeText) throw new Error('clipboard-unavailable');
		await navigator.clipboard.writeText(text);
	} catch {
		writeTextFallback(text);
	}
}

export async function copyLifeHash(dataUrl: string, title: string): Promise<'copied' | 'saved'> {
	const blob = await lifeHashCopyBlob(dataUrl);
	try {
		await writeClipboardBlob(blob);
		return 'copied';
	} catch {
		downloadBlob(blob, lifeHashFileName(title));
		return 'saved';
	}
}

export function canShareIdentity(): boolean {
	return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

export async function shareIdentity(opts: {
	title: string;
	words: string;
	lifeHash: string;
}): Promise<boolean> {
	if (!canShareIdentity()) return false;
	const text = formatWordsForCopy(opts.words);
	const title = `XChan ${opts.title}`.trim();
	const blob = await lifeHashCopyBlob(opts.lifeHash);
	const file = new File([blob], lifeHashFileName(opts.title), {
		type: blob.type || 'image/png'
	});
	const withFiles = { title, text, files: [file] };
	try {
		if (typeof navigator.canShare !== 'function' || navigator.canShare(withFiles)) {
			await navigator.share(withFiles);
			return true;
		}
	} catch (err) {
		if (isAbortError(err)) return false;
	}
	try {
		await navigator.share({ title, text });
		return true;
	} catch (err) {
		if (isAbortError(err)) return false;
		throw err;
	}
}

export function downloadBlob(blob: Blob, filename: string): void {
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = filename;
	link.rel = 'noopener';
	document.body.append(link);
	link.click();
	link.remove();
	setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

async function writeClipboardBlob(blob: Blob): Promise<void> {
	if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) {
		throw new Error('clipboard-image-unsupported');
	}
	const type = blob.type || 'image/png';
	try {
		await navigator.clipboard.write([new ClipboardItem({ [type]: blob })]);
	} catch {
		await navigator.clipboard.write([new ClipboardItem({ [type]: Promise.resolve(blob) })]);
	}
}

function writeTextFallback(text: string): void {
	if (typeof document === 'undefined') throw new Error('clipboard-unavailable');
	const ta = document.createElement('textarea');
	ta.value = text;
	ta.setAttribute('readonly', '');
	ta.style.position = 'fixed';
	ta.style.top = '0';
	ta.style.left = '-9999px';
	document.body.append(ta);
	ta.select();
	const ok = document.execCommand('copy');
	ta.remove();
	if (!ok) throw new Error('copy-failed');
}

function isAbortError(err: unknown): boolean {
	return typeof err === 'object' && err !== null && 'name' in err && err.name === 'AbortError';
}
