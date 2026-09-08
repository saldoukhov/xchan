import { LOCALE_KEY, dictionaries, resolveLocale, type Locale } from './i18n';

const initial = resolveLocale();

export const i18n = $state({
	locale: initial,
	m: dictionaries[initial]
});

export function applyLocale(locale: Locale) {
	i18n.locale = locale;
	i18n.m = dictionaries[locale];
	if (typeof document !== 'undefined') {
		document.documentElement.lang = locale;
	}
	try {
		localStorage.setItem(LOCALE_KEY, locale);
	} catch {
		// private mode
	}
}

export function initLocale() {
	applyLocale(resolveLocale());
}

export {
	LOCALE_LABELS,
	LOCALES,
	fill,
	formatReleaseDate,
	rich,
	translateRelayMessage,
	type Locale
} from './i18n';
