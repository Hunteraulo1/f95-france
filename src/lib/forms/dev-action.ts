import { createActionResultEnhance } from '$lib/forms/enhance';
import type { ActionResult, SubmitFunction } from '@sveltejs/kit';

/** Données renvoyées par une action dev (`success` / `failure`). */
export function actionDataRecord(result: ActionResult): Record<string, unknown> | null {
	if (
		(result.type === 'success' || result.type === 'failure') &&
		result.data &&
		typeof result.data === 'object'
	) {
		return result.data as Record<string, unknown>;
	}
	return null;
}

export function boolFromRecord(data: Record<string, unknown>, key: string): boolean {
	return key in data && Boolean(data[key]);
}

export function strFromRecord(data: Record<string, unknown>, key: string, fallback = ''): string {
	return typeof data[key] === 'string' ? data[key] : fallback;
}

/** `use:enhance` pour les actions dev qui renvoient `{ success, message, details? }`. */
export function createDevActionEnhance<T>(options: {
	setLoading: (loading: boolean) => void;
	setResult: (result: T | null) => void;
	map: (data: Record<string, unknown>) => T;
}): SubmitFunction {
	return createActionResultEnhance({
		onStart: () => {
			options.setLoading(true);
			options.setResult(null);
		},
		onResult: (result) => {
			options.setLoading(false);
			const data = actionDataRecord(result);
			if (data) options.setResult(options.map(data));
		}
	});
}
