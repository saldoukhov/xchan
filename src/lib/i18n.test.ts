import { afterEach, describe, expect, it, vi } from 'vitest';
import { en } from './i18n/en';
import {
	LOCALES,
	LOCALE_LABELS,
	detectBrowserLocale,
	dictionaries,
	fill,
	formatReleaseDate,
	parseLocale,
	rich,
	translateRelayMessage
} from './i18n';

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('parseLocale', () => {
	it('accepts the five supported languages and regional tags', () => {
		expect(parseLocale('en')).toBe('en');
		expect(parseLocale('es-MX')).toBe('es');
		expect(parseLocale('ru_RU')).toBe('ru');
		expect(parseLocale('fr-CA')).toBe('fr');
		expect(parseLocale('de-AT')).toBe('de');
		expect(parseLocale('EN')).toBe('en');
	});

	it('rejects unknown or empty values', () => {
		expect(parseLocale('')).toBeUndefined();
		expect(parseLocale(null)).toBeUndefined();
		expect(parseLocale('pt')).toBeUndefined();
		expect(parseLocale('zh-CN')).toBeUndefined();
	});
});

describe('detectBrowserLocale', () => {
	it('uses the first supported browser language', () => {
		vi.stubGlobal('navigator', { language: 'pt-BR', languages: ['pt-BR', 'es-ES', 'en'] });
		expect(detectBrowserLocale()).toBe('es');
	});

	it('falls back to English', () => {
		vi.stubGlobal('navigator', { language: 'ja', languages: ['ja'] });
		expect(detectBrowserLocale()).toBe('en');
	});
});

describe('dictionaries', () => {
	it('ships a native name for every supported language', () => {
		expect(LOCALES).toEqual(['en', 'es', 'ru', 'fr', 'de']);
		expect(LOCALE_LABELS.en).toBe('English');
		expect(LOCALE_LABELS.es).toBe('Español');
		expect(LOCALE_LABELS.ru).toBe('Русский');
		expect(LOCALE_LABELS.fr).toBe('Français');
		expect(LOCALE_LABELS.de).toBe('Deutsch');
	});

	it('keeps the same message keys in every language', () => {
		const enKeys = JSON.stringify(keysOf(en));
		for (const locale of LOCALES) {
			expect(JSON.stringify(keysOf(dictionaries[locale]))).toBe(enKeys);
		}
	});
});

describe('fill', () => {
	it('substitutes named placeholders', () => {
		expect(fill('Waiting for {name}.', { name: 'Pixel' })).toBe('Waiting for Pixel.');
		expect(fill('max {size}', { size: '50.0 MB' })).toBe('max 50.0 MB');
	});

	it('leaves unknown placeholders intact', () => {
		expect(fill('Hello {name}', {})).toBe('Hello {name}');
	});
});

describe('rich', () => {
	it('splits strong tags so the UI can render them without HTML', () => {
		expect(rich('Press <strong>Pair</strong> now.')).toEqual([
			{ text: 'Press ' },
			{ text: 'Pair', strong: true },
			{ text: ' now.' }
		]);
		expect(rich('plain')).toEqual([{ text: 'plain' }]);
	});
});

describe('translateRelayMessage', () => {
	it('maps known English relay errors and keeps the retry suffix', () => {
		expect(translateRelayMessage('Pairing is busy. Try again in 15s.', en)).toBe(
			'Pairing is busy. Try again in 15s.'
		);
		expect(
			translateRelayMessage('Too many pairing attempts. Try again in 8s.', dictionaries.es)
		).toBe('Demasiados intentos de emparejamiento. Inténtalo de nuevo en 8 s.');
	});

	it('leaves unknown server text unchanged', () => {
		expect(translateRelayMessage('nope', en)).toBe('nope');
	});
});

describe('formatReleaseDate', () => {
	it('formats a UTC calendar date in the selected locale', () => {
		expect(formatReleaseDate('2026-09-08', 'en')).toMatch(/2026/);
		expect(formatReleaseDate('not-a-date', 'en')).toBe('not-a-date');
	});
});

function keysOf(value: unknown, prefix = ''): string[] {
	if (typeof value !== 'object' || value === null) return [prefix];
	return Object.entries(value).flatMap(([key, child]) =>
		keysOf(child, prefix ? `${prefix}.${key}` : key)
	);
}
