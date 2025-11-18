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

export const logApiAction = async ({ method, route, status, userId, payload, errorMessage }: LogPayload) => {
	try {
		await db.insert(apiLog).values({
			method,
			route,
			status,
			userId: userId ?? null,
			payload: payload ?? null,
			errorMessage: errorMessage ? (errorMessage.length > 10000 ? `${errorMessage.slice(0, 10000)}…` : errorMessage) : null
		});
	} catch (error) {
		console.error('Erreur lors de la création du log API:', error);
	}
};
