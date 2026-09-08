import { de } from './i18n/de';
import { en, type Messages } from './i18n/en';
import { es } from './i18n/es';
import { fr } from './i18n/fr';
import { ru } from './i18n/ru';

export type { Messages };

export const LOCALES = ['en', 'es', 'ru', 'fr', 'de'] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_KEY = 'xchan-locale';

export const LOCALE_LABELS: Record<Locale, string> = {
	en: 'English',
	es: 'Español',
	ru: 'Русский',
	fr: 'Français',
	de: 'Deutsch'
};

export const dictionaries: Record<Locale, Messages> = {
	en,
	es,
	ru,
	fr,
	de
};

export function isLocale(value: unknown): value is Locale {
	return value === 'en' || value === 'es' || value === 'ru' || value === 'fr' || value === 'de';
}

export function parseLocale(value: string | null | undefined): Locale | undefined {
	if (!value) return undefined;
	const base = value.trim().toLowerCase().replaceAll('_', '-').split('-')[0];
	return isLocale(base) ? base : undefined;
}

export function detectBrowserLocale(): Locale {
	if (typeof navigator === 'undefined') return 'en';
	const candidates = [navigator.language, ...(navigator.languages ?? [])];
	for (const candidate of candidates) {
		const parsed = parseLocale(candidate);
		if (parsed) return parsed;
	}
	return 'en';
}

export function readStoredLocale(): Locale | undefined {
	if (typeof localStorage === 'undefined') return undefined;
	try {
		return parseLocale(localStorage.getItem(LOCALE_KEY));
	} catch {
		return undefined;
	}
}

export function resolveLocale(): Locale {
	return readStoredLocale() ?? detectBrowserLocale();
}

export function fill(template: string, vars: Record<string, string | number>): string {
	return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
		Object.hasOwn(vars, key) ? String(vars[key]) : whole
	);
}

export type RichPart = { text: string; strong?: boolean };

/** Split trusted translation strings that use `<strong>` into typed parts. */
export function rich(text: string): RichPart[] {
	const parts: RichPart[] = [];
	const re = /<strong>(.*?)<\/strong>/g;
	let last = 0;
	for (const match of text.matchAll(re)) {
		const index = match.index ?? 0;
		if (index > last) parts.push({ text: text.slice(last, index) });
		parts.push({ text: match[1] ?? '', strong: true });
		last = index + match[0].length;
	}
	if (last < text.length) parts.push({ text: text.slice(last) });
	return parts;
}

export function translateRelayMessage(text: string, m: Messages): string {
	const match = text.match(/Try again in (\d+)s\.?\s*$/);
	const seconds = match?.[1];
	const retry = seconds ? ` ${fill(m.pair.tryAgainIn, { seconds })}` : '';
	if (text.startsWith('Pairing is busy.')) return m.pair.busy + retry;
	if (text.startsWith('This network already has pairing in progress.')) {
		return m.pair.networkBusy + retry;
	}
	if (text.startsWith('Too many recent pairings.')) return m.pair.tooManyRecent + retry;
	if (text.startsWith('Too many pairing attempts.')) return m.pair.tooManyAttempts + retry;
	return text;
}

export function formatReleaseDate(iso: string, locale: Locale): string {
	const date = new Date(`${iso}T00:00:00Z`);
	if (Number.isNaN(date.getTime())) return iso;
	return date.toLocaleDateString(locale, {
		year: 'numeric',
		month: 'long',
		day: 'numeric',
		timeZone: 'UTC'
	});
}
