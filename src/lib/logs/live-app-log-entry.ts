import type { AppLogLevel, AppLogSource } from '$lib/logs/app-log';

export type LiveAppLogEntry = {
	id: string;
	level: AppLogLevel;
	source: AppLogSource | string;
	message: string;
	meta: string | null;
	createdAt: string;
};
