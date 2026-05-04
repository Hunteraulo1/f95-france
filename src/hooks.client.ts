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

/** Remplace le `console.error(error)` par défaut (souvent affiché comme « Object » dans la console). */
export const handleError: HandleClientError = ({ error, event, status, message }) => {
	const path = event.url?.pathname ?? '';
	console.error('[SvelteKit client]', status, path, message, formatErrorDetail(error));

	return { message: message || 'Une erreur est survenue.' };
};
