import { env as processEnv } from 'node:process';

export type MariadbConfig = {
	host: string;
	port: number;
	database: string;
	user: string;
	password: string;
	ssl?: boolean;
};

export type DbEnvSource = Record<string, string | undefined>;

function pickEnv(source: DbEnvSource, ...keys: string[]): string | undefined {
	for (const key of keys) {
		const raw = source[key];
		if (typeof raw === 'string') return raw;
	}
	return undefined;
}

function pickEnvTrimmed(source: DbEnvSource, ...keys: string[]): string | undefined {
	const value = pickEnv(source, ...keys);
	if (value === undefined) return undefined;
	const trimmed = value.trim();
	return trimmed === '' ? undefined : trimmed;
}

function isLocalHost(host: string): boolean {
	return /^(localhost|127\.0\.0\.1)$/i.test(host.trim());
}

function isInternalHost(host: string): boolean {
	const h = host.trim();
	if (isLocalHost(h)) return true;

	const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
	if (m) {
		const a = Number(m[1]);
		const b = Number(m[2]);
		if (a === 10) return true;
		if (a === 172 && b >= 16 && b <= 31) return true;
		if (a === 192 && b === 168) return true;
	}

	// Nom de service Docker (ex. mariadb sur le réseau Coolify)
	if (!h.includes('.')) return true;

	return false;
}

function sslFromEnv(source: DbEnvSource, host: string): boolean {
	const m = pickEnv(source, 'MARIADB_SSL_MODE')?.toLowerCase();
	if (m === 'disable') return false;
	if (m === 'require') return true;
	if (isInternalHost(host)) return false;
	return true;
}

function resolveDbCredentials(source: DbEnvSource): {
	host: string;
	port: number;
	database: string;
	user: string;
	password: string;
} | null {
	const host = pickEnvTrimmed(source, 'MARIADB_HOST');
	if (!host) return null;

	const password = pickEnv(source, 'MARIADB_PASSWORD');
	if (password === undefined) return null;

	const portRaw = pickEnvTrimmed(source, 'MARIADB_PORT');
	const port = portRaw ? Number.parseInt(portRaw, 10) : 3306;

	return {
		host,
		port: Number.isFinite(port) ? port : 3306,
		database: pickEnvTrimmed(source, 'MARIADB_DATABASE') ?? 'f95france',
		user: pickEnvTrimmed(source, 'MARIADB_USER') ?? 'f95france',
		password
	};
}

export function getMariadbConfigFromEnv(source: DbEnvSource = processEnv): MariadbConfig {
	const credentials = resolveDbCredentials(source);
	if (!credentials) {
		throw new Error(
			'Configuration base de données manquante : définir MARIADB_HOST + MARIADB_PASSWORD'
		);
	}

	return {
		...credentials,
		ssl: sslFromEnv(source, credentials.host)
	};
}

export function getMariadbConfig(): MariadbConfig {
	return getMariadbConfigFromEnv(processEnv);
}

export function getMariadbUrl(source: DbEnvSource = processEnv): string {
	const config = getMariadbConfigFromEnv(source);
	const base = `mysql://${encodeURIComponent(config.user)}:${encodeURIComponent(config.password)}@${config.host}:${config.port}/${encodeURIComponent(config.database)}`;
	if (config.ssl === false) return base;
	return `${base}?ssl=true`;
}
