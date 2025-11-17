import { db } from '$lib/server/db';
import { apiLog } from '$lib/server/db/schema';

type LogPayload = {
	method: string;
	route: string;
	status: number;
	userId?: string | null;
	payload?: string | null;
};

export const logApiAction = async ({ method, route, status, userId, payload }: LogPayload) => {
	try {
		await db.insert(apiLog).values({
			method,
			route,
			status,
			userId: userId ?? null,
			payload: payload ?? null
		});
	} catch (error) {
		console.error('Erreur lors de la création du log API:', error);
	}
};
