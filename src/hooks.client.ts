import type { HandleClientError } from '@sveltejs/kit';

function formatErrorDetail(error: unknown): string {
	if (error instanceof Error) {
		return `${error.name}: ${error.message}`;
	}
	if (error && typeof error === 'object' && 'message' in error) {
		return String((error as { message: unknown }).message);
	}
	try {
		return JSON.stringify(error);
	} catch {
		return String(error);
	}
}

/** En dev, fetch / preload / HMR peuvent couper une requête : ce n’est pas un bug applicatif. */
function isLikelyTransientDevNetworkError(error: unknown): boolean {
	if (!import.meta.env.DEV) return false;
	const detail = formatErrorDetail(error).toLowerCase();
	return (
		detail.includes('networkerror') ||
		detail.includes('failed to fetch') ||
		detail.includes('fetch resource') ||
		detail.includes('network request failed') ||
		detail.includes('load failed')
	);
}

/** Remplace le `console.error(error)` par défaut (souvent affiché comme « Object » dans la console). */
export const handleError: HandleClientError = ({ error, event, status, message }) => {
	const path = event.url?.pathname ?? '';
	const detail = formatErrorDetail(error);

	if (isLikelyTransientDevNetworkError(error)) {
		console.debug('[SvelteKit client] (dev, réseau transitoire)', status, path, message, detail);
	} else {
		console.error('[SvelteKit client]', status, path, message, detail);
	}

	return { message: message || 'Une erreur est survenue.' };
};
