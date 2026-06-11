import type { LiveLogEntry } from '$lib/logs/live-log-entry';
import { appLogError } from '$lib/server/app-log-bridge';
import { db } from '$lib/server/db';
import { apiLog, user } from '$lib/server/db/schema';
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
	ipAddress,
	payload,
	errorMessage
}: LogPayload) => {
	try {
		const id = randomUUID();
		const createdAt = new Date();
		await db.insert(apiLog).values({
			id,
			method,
			route,
			status,
			userId: userId ?? null,
			ipAddress: ipAddress ?? null,
			payload: payload ?? null,
			errorMessage: errorMessage ?? null,
			createdAt
		});

		if (!route.startsWith('/api/extension-api')) {
			const inserted = { id, createdAt };
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

			broadcastLiveLogEntry({
				id: inserted.id,
				method,
				route,
				status,
				ipAddress: ipAddress ?? null,
				payload: payload ?? null,
				errorMessage: errorMessage ?? null,
				createdAt: inserted.createdAt.toISOString(),
				user: logUser
			});
		}
	} catch (error) {
		if (isDbTimeoutError(error)) {
			// Avoid flooding logs when DB is temporarily unreachable.
			return;
		}
		appLogError('db', 'Création log API échouée', error, { route, method, status });
	}
};
