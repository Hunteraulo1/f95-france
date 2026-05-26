import type { ActionResult, SubmitFunction } from '@sveltejs/kit';

type FormFailureData = { message?: string };
type SuccessResult = Extract<ActionResult, { type: 'success' }>;

export type FormEnhanceContext = {
	formElement?: HTMLFormElement;
};

export type FormEnhanceValidateInput = {
	cancel: () => void;
};

export type FormEnhanceOptions = {
	locked?: boolean;
	/** Validation côté client avant envoi ; appeler `cancel()` pour bloquer la soumission. */
	validate?: (input: FormEnhanceValidateInput) => void;
	/** Appelé au début de la soumission (ex. réinitialiser les messages d’erreur). */
	onStart?: () => void;
	onFailure?: (message: string) => void;
	onSuccess?: (result: SuccessResult, context: FormEnhanceContext) => void | Promise<void>;
	onRedirect?: () => void;
	/** Ne pas appeler `update()` après un échec (garde les valeurs du formulaire). */
	updateOnlyOnSuccess?: boolean;
	invalidateAll?: boolean;
};

function failureMessage(result: Extract<ActionResult, { type: 'failure' }>): string {
	const data = result.data as FormFailureData | undefined;
	if (data?.message) return data.message;
	if (typeof result.data === 'object' && result.data && 'message' in result.data) {
		return String((result.data as FormFailureData).message);
	}
	return 'Erreur';
}

/** Callback `use:enhance` standard (échec, redirect, `update`). */
export function createFormEnhance(options: FormEnhanceOptions = {}): SubmitFunction {
	return ({ cancel }) => {
		if (options.locked) return () => {};
		let cancelled = false;
		options.validate?.({
			cancel: () => {
				cancelled = true;
				cancel();
			}
		});
		if (cancelled) return;
		options.onStart?.();
		return async ({ result, update, formElement }) => {
			const context: FormEnhanceContext = { formElement: formElement ?? undefined };

			if (result.type === 'failure') {
				options.onFailure?.(failureMessage(result));
				if (!options.updateOnlyOnSuccess) {
					await update(options.invalidateAll ? { invalidateAll: true } : undefined);
				}
				return;
			}

			const shouldUpdate =
				!options.updateOnlyOnSuccess || result.type === 'success' || result.type === 'redirect';
			if (shouldUpdate) {
				await update(options.invalidateAll ? { invalidateAll: true } : undefined);
			}

			if (result.type === 'success') {
				await options.onSuccess?.(result, context);
			} else if (result.type === 'redirect') {
				options.onRedirect?.();
			}
		};
	};
}

/** Pour les actions dev qui lisent `result.data` après chaque `update()`. */
export function createActionResultEnhance(options: {
	onStart?: () => void;
	onResult: (result: ActionResult) => void | Promise<void>;
}): SubmitFunction {
	return () => {
		options.onStart?.();
		return async ({ result, update }) => {
			await update();
			await options.onResult(result);
		};
	};
}
