import { db } from '$lib/server/db';
import { apiLog } from '$lib/server/db/schema';

type LogPayload = {
	method: string;
	route: string;
	status: number;
	userId?: string | null;
	payload?: string | null;
	errorMessage?: string | null;
};

const isDbTimeoutError = (error: unknown): boolean => {
	if (!error || typeof error !== 'object') return false;
	if ('code' in error && error.code === 'ETIMEDOUT') return true;
	if ('cause' in error && error.cause && typeof error.cause === 'object' && 'code' in error.cause) {
		return error.cause.code === 'ETIMEDOUT';
	}
	return false;
};

export const logApiAction = async ({
	method,
	route,
	status,
	userId,
	payload,
	errorMessage
}: LogPayload) => {
	try {
		await db.insert(apiLog).values({
			method,
			route,
			status,
			userId: userId ?? null,
			payload: payload ?? null,
			errorMessage: errorMessage
				? errorMessage.length > 10000
					? `${errorMessage.slice(0, 10000)}…`
					: errorMessage
				: null
		});
	} catch (error) {
		if (isDbTimeoutError(error)) {
			// Avoid flooding logs when DB is temporarily unreachable.
			return;
		}
		console.error('Erreur lors de la création du log API:', error);
	}
};
