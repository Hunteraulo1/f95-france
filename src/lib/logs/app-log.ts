export const APP_LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;
export type AppLogLevel = (typeof APP_LOG_LEVELS)[number];

export const APP_LOG_SOURCES = [
	'cron',
	'worker',
	'queue',
	'scrape',
	'notification',
	'auth',
	'db',
	'sheets-sync',
	'system'
] as const;
export type AppLogSource = (typeof APP_LOG_SOURCES)[number];

export const DEFAULT_APP_LOG_LEVELS: AppLogLevel[] = ['info', 'warn', 'error'];

export function parseAppLogLevelsParam(raw: string | null | undefined): AppLogLevel[] {
	if (!raw?.trim()) return [...DEFAULT_APP_LOG_LEVELS];
	const picked = raw
		.split(',')
		.map((s) => s.trim().toLowerCase())
		.filter((s): s is AppLogLevel => APP_LOG_LEVELS.includes(s as AppLogLevel));
	return picked.length > 0 ? picked : [...APP_LOG_LEVELS];
}

export function appLogLevelsToParam(levels: AppLogLevel[]): string {
	return levels.join(',');
}
