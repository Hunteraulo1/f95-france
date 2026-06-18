import type { AppLogLevel, AppLogSource } from '$lib/logs/app-log';
import type { LiveAppLogEntry } from '$lib/logs/live-app-log-entry';
import { broadcastLiveAppLogEntry } from '$lib/server/app-logs-live-hub';
import { writeElkLog } from '$lib/server/elk-file-logger';
import { randomUUID } from 'node:crypto';

const META_MAX = 8_000;

type LogAppPayload = {
	level: AppLogLevel;
	source: AppLogSource | string;
	message: string;
	meta?: Record<string, unknown> | string | null;
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

function elkMeta(meta: LogAppPayload['meta']): Record<string, unknown> | string | null {
	if (meta == null) return null;
	if (typeof meta === 'string') {
		return meta.length > META_MAX ? meta.slice(0, META_MAX) : meta;
	}
	return meta;
}

function persistAppLog({ level, source, message, meta }: LogAppPayload) {
	const metaText = serializeMeta(meta);
	const id = randomUUID();
	const createdAt = new Date();

	writeElkLog({
		level,
		source,
		message: message.length > 16_000 ? message.slice(0, 16_000) : message,
		meta: elkMeta(meta)
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
}

/** Journal applicatif (cron, workers, queues…) — non bloquant. */
export function logApp(payload: LogAppPayload): void {
	try {
		persistAppLog(payload);
	} catch (error) {
		console.error('[app-logger] échec persistance:', error);
	}
}
