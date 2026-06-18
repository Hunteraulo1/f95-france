import { privateEnv } from '$lib/server/private-env';
import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const LOG_FILE = privateEnv('ELK_LOG_FILE') ?? '/app/logs/f95france-dashboard.log';
const ELK_LOG_ENABLED = privateEnv('ELK_LOG_ENABLED') === 'true';

type ElkLogPayload = {
	level: 'debug' | 'info' | 'warn' | 'error';
	source: string;
	message: string;
	meta?: Record<string, unknown> | string | null;
};

let logDirReady: Promise<void> | null = null;

function ensureLogDir(): Promise<void> {
	if (!logDirReady) {
		logDirReady = mkdir(dirname(LOG_FILE), { recursive: true }).then(() => undefined);
	}
	return logDirReady;
}

function safeJsonStringify(value: unknown): string {
	try {
		return JSON.stringify(value);
	} catch {
		return JSON.stringify({
			'@timestamp': new Date().toISOString(),
			service: {
				name: privateEnv('SERVICE_NAME') ?? 'f95france-dashboard',
				type: 'sveltekit'
			},
			environment: privateEnv('APP_ENV') ?? privateEnv('NODE_ENV') ?? 'unknown',
			log: { level: 'error' },
			source: 'elk-file-logger',
			message: 'Impossible de sérialiser le log',
			meta: null
		});
	}
}

export function writeElkLog(payload: ElkLogPayload): void {
	if (!ELK_LOG_ENABLED) return;

	const line = safeJsonStringify({
		'@timestamp': new Date().toISOString(),
		service: {
			name: privateEnv('SERVICE_NAME') ?? 'f95france-dashboard',
			type: 'sveltekit'
		},
		event: {
			dataset: 'f95france-dashboard'
		},
		environment: privateEnv('APP_ENV') ?? privateEnv('NODE_ENV') ?? 'unknown',
		log: {
			level: payload.level
		},
		log_source: payload.source,
		message: payload.message,
		meta: payload.meta ?? null
	});

	void ensureLogDir()
		.then(() => appendFile(LOG_FILE, `${line}\n`, 'utf8'))
		.catch((error) => {
			console.error('[elk-file-logger] write failed:', error);
		});
}
