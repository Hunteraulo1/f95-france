import type { AppLogLevel, AppLogSource } from '$lib/logs/app-log';
import type { LiveAppLogEntry } from '$lib/logs/live-app-log-entry';
import { broadcastLiveAppLogEntry } from '$lib/server/app-logs-live-hub';
import { db } from '$lib/server/db';
import { appLog } from '$lib/server/db/schema';
import { randomUUID } from 'node:crypto';

const META_MAX = 8_000;

type LogAppPayload = {
	level: AppLogLevel;
	source: AppLogSource | string;
	message: string;
	meta?: Record<string, unknown> | string | null;
};

const isDbTimeoutError = (error: unknown): boolean => {
	if (!error || typeof error !== 'object') return false;
	if ('code' in error && error.code === 'ETIMEDOUT') return true;
	if ('cause' in error && error.cause && typeof error.cause === 'object' && 'code' in error.cause) {
		return error.cause.code === 'ETIMEDOUT';
	}
	return false;
};

function serializeMeta(meta: LogAppPayload['meta']): string | null {
	if (meta == null) return null;
	if (typeof meta === 'string') {
		return meta.length > META_MAX ? meta.slice(0, META_MAX) : meta;
	}
	try {
		const json = JSON.stringify(meta);
		return json.length > META_MAX ? json.slice(0, META_MAX) : json;
	} catch {
		return null;
	}
}

async function persistAppLog({ level, source, message, meta }: LogAppPayload) {
	try {
		const metaText = serializeMeta(meta);
		const id = randomUUID();
		const createdAt = new Date();
		await db.insert(appLog).values({
			id,
			level,
			source,
			message: message.length > 16_000 ? message.slice(0, 16_000) : message,
			meta: metaText,
			createdAt
		});

		const entry: LiveAppLogEntry = {
			id,
			level,
			source,
			message,
			meta: metaText,
			createdAt: createdAt.toISOString()
		};
		broadcastLiveAppLogEntry(entry);
	} catch (error) {
		if (isDbTimeoutError(error)) return;
		console.error('[app-logger] échec persistance:', error);
	}
}

/** Journal applicatif (cron, workers, queues…) — non bloquant. */
export function logApp(payload: LogAppPayload): void {
	void persistAppLog(payload);
}
