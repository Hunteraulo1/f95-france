import type { AppLogLevel, AppLogSource } from '$lib/logs/app-log';
import { logApp } from '$lib/server/app-logger';

function errorDetail(error: unknown): string | undefined {
	if (error instanceof Error) return error.message;
	if (error != null) return String(error);
	return undefined;
}

type OperationalLogOptions = {
	source: AppLogSource | string;
	message: string;
	level?: AppLogLevel;
	error?: unknown;
	meta?: Record<string, unknown>;
};

/** Persiste dans `app_log` et garde la sortie console pour le dev local. */
export function appLogOperational({
	source,
	message,
	level = 'warn',
	error,
	meta
}: OperationalLogOptions): void {
	const detail = errorDetail(error);
	logApp({
		level,
		source,
		message,
		meta: { ...meta, ...(detail ? { detail } : {}) }
	});

	const prefix = `[${source}]`;
	if (level === 'error') console.error(prefix, message, error ?? '');
	else if (level === 'debug') console.debug(prefix, message, error ?? '');
	else console.warn(prefix, message, error ?? '');
}

export function appLogWarn(
	source: AppLogSource | string,
	message: string,
	error?: unknown,
	meta?: Record<string, unknown>
): void {
	appLogOperational({ source, message, level: 'warn', error, meta });
}

export function appLogError(
	source: AppLogSource | string,
	message: string,
	error?: unknown,
	meta?: Record<string, unknown>
): void {
	appLogOperational({ source, message, level: 'error', error, meta });
}
