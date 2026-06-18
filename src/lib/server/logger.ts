import type { LiveLogEntry } from '$lib/logs/live-log-entry';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import { writeElkLog } from '$lib/server/elk-file-logger';
import { broadcastLiveLogEntry } from '$lib/server/logs-live-hub';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

type LogPayload = {
	method: string;
	route: string;
	status: number;
	userId?: string | null;
	ipAddress?: string | null;
	payload?: string | null;
	errorMessage?: string | null;
};

async function persistApiLog({
	method,
	route,
	status,
	userId,
	ipAddress,
	payload,
	errorMessage
}: LogPayload) {
	const id = randomUUID();
	const createdAt = new Date();
	let logUser: LiveLogEntry['user'] = null;

	if (userId) {
		const [row] = await db
			.select({
				id: user.id,
				username: user.username,
				role: user.role
			})
			.from(user)
			.where(eq(user.id, userId))
			.limit(1);
		if (row?.username) {
			logUser = {
				id: row.id,
				username: row.username,
				role: row.role
			};
		}
	}

	writeElkLog({
		level: status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info',
		source: 'api',
		message: `${method} ${route} ${status}`,
		meta: {
			method,
			route,
			status,
			userId: userId ?? null,
			username: logUser?.username ?? null,
			userRole: logUser?.role ?? null,
			ipAddress: ipAddress ?? null,
			payload: payload ?? null,
			errorMessage: errorMessage ?? null
		}
	});

	if (!route.startsWith('/api/extension-api')) {
		broadcastLiveLogEntry({
			id,
			method,
			route,
			status,
			ipAddress: ipAddress ?? null,
			payload: payload ?? null,
			errorMessage: errorMessage ?? null,
			createdAt: createdAt.toISOString(),
			user: logUser
		});
	}
}

export const logApiAction = async (payload: LogPayload) => {
	try {
		await persistApiLog(payload);
	} catch (error) {
		console.error('[logger] échec persistance log API:', error);
	}
};
