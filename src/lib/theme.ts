import { get, writable } from 'svelte/store';

export type AppTheme = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'theme';

/** Préférence active côté client (non écrasée par syncSessionFromLayoutData). */
export const themePreference = writable<AppTheme | null>(null);

export function isAppTheme(value: string | null | undefined): value is AppTheme {
	return value === 'system' || value === 'light' || value === 'dark';
}

export function systemPrefersDark(): boolean {
	return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/** Résout system → light ou dark (jamais « system » sur data-theme). */
export function resolveEffectiveTheme(theme: AppTheme): 'light' | 'dark' {
	if (theme === 'light') return 'light';
	if (theme === 'dark') return 'dark';
	return systemPrefersDark() ? 'dark' : 'light';
}

/** Applique le thème daisyUI sur <html>. */
export function applyAppTheme(theme: AppTheme): void {
	const effective = resolveEffectiveTheme(theme);
	const root = document.documentElement;
	root.setAttribute('data-theme', effective);
	root.style.colorScheme = effective;
	try {
		if (theme === 'system') {
			localStorage.removeItem(STORAGE_KEY);
		} else {
			localStorage.setItem(STORAGE_KEY, theme);
		}
	} catch {
		/* navigation privée, etc. */
	}
}

export function readStoredThemePreference(): AppTheme | null {
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored === 'light' || stored === 'dark') return stored;
	} catch {
		/* ignore */
	}
	return null;
}

export function getThemePreference(): AppTheme {
	return get(themePreference) ?? readStoredThemePreference() ?? 'system';
}

/** Met à jour la préférence client + DOM (source de vérité pour l’affichage). */
export function setThemePreference(theme: AppTheme): void {
	themePreference.set(theme);
	applyAppTheme(theme);
}

/** Initialise la préférence depuis le profil (connexion / changement de compte). */
export function syncThemePreferenceFromUser(userTheme: string | null | undefined): void {
	if (isAppTheme(userTheme)) {
		setThemePreference(userTheme);
		return;
	}
	setThemePreference(readStoredThemePreference() ?? 'system');
}

/** Réapplique le thème quand la préférence système change (mode « Système »). */
export function setupSystemThemeListener(getTheme: () => AppTheme): () => void {
	const mq = window.matchMedia('(prefers-color-scheme: dark)');
	const onChange = () => {
		if (getTheme() === 'system') applyAppTheme('system');
	};
	mq.addEventListener('change', onChange);
	return () => mq.removeEventListener('change', onChange);
}
