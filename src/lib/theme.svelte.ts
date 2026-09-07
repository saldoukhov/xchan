export type Theme = 'dark' | 'light';

export const THEME_KEY = 'xchan-theme';
export const THEME_COLOR_DARK = '#000000';
export const THEME_COLOR_LIGHT = '#F8F8F8';

export function readStoredTheme(): Theme {
	if (typeof localStorage === 'undefined') return 'dark';
	try {
		const value = localStorage.getItem(THEME_KEY);
		if (value === 'light' || value === 'dark') return value;
	} catch {
		// private mode
	}
	return 'dark';
}

export const themeState = $state({
	theme: readStoredTheme()
});

export function applyTheme(theme: Theme) {
	themeState.theme = theme;
	if (typeof document === 'undefined') return;
	const root = document.documentElement;
	root.dataset.theme = theme;
	root.style.colorScheme = theme;
	const meta = document.querySelector('meta[name="theme-color"]');
	if (meta) {
		meta.setAttribute('content', theme === 'light' ? THEME_COLOR_LIGHT : THEME_COLOR_DARK);
	}
	try {
		localStorage.setItem(THEME_KEY, theme);
	} catch {
		// private mode
	}
}

export function toggleTheme() {
	applyTheme(themeState.theme === 'dark' ? 'light' : 'dark');
}

export function initTheme() {
	applyTheme(readStoredTheme());
}
