import { env as processEnv } from 'node:process';

/**
 * Configuration de connexion Postgres (variables POSTGRES_* / PG* dans l’env).
 */
export type PostgresConfig = {
	host: string;
	port: number;
	database: string;
	user: string;
	password: string;
	ssl?: boolean | 'require';
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

function isLocalPostgresHost(host: string): boolean {
	return /^(localhost|127\.0\.0\.1)$/i.test(host.trim());
}

/** Réseau privé / Docker Coolify : pas de TLS par défaut (hostname sans point, IP privée). */
function isInternalPostgresHost(host: string): boolean {
	const h = host.trim();
	if (isLocalPostgresHost(h)) return true;

	const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
	if (m) {
		const a = Number(m[1]);
		const b = Number(m[2]);
		if (a === 10) return true;
		if (a === 172 && b >= 16 && b <= 31) return true;
		if (a === 192 && b === 168) return true;
	}

	// Nom de service Docker (ex. g62ovatby0hdggb8dwx5n831 sur le réseau Coolify)
	if (!h.includes('.')) return true;

	return false;
}

/** `POSTGRES_SSL_MODE=disable` en local ; `require` pour Postgres distant si non précisé. */
function sslFromEnv(source: DbEnvSource, host: string): boolean | 'require' {
	const m = pickEnv(source, 'POSTGRES_SSL_MODE', 'PGSSLMODE')?.toLowerCase();
	if (m === 'disable') return false;
	if (m === 'require' || m === 'verify-full' || m === 'verify-ca') return 'require';
	if (m === 'prefer' || m === 'allow') return 'require';
	if (isInternalPostgresHost(host)) return false;
	return 'require';
}

function resolveDbCredentials(source: DbEnvSource): {
	host: string;
	port: number;
	database: string;
	user: string;
	password: string;
} | null {
	const host = pickEnvTrimmed(source, 'POSTGRES_HOST', 'PGHOST');
	if (!host) return null;

	const password = pickEnv(source, 'POSTGRES_PASSWORD', 'PGPASSWORD');
	if (password === undefined) return null;

	const portRaw = pickEnvTrimmed(source, 'POSTGRES_PORT', 'PGPORT');
	const port = portRaw ? Number.parseInt(portRaw, 10) : 5432;

	return {
		host,
		port: Number.isFinite(port) ? port : 5432,
		database: pickEnvTrimmed(source, 'POSTGRES_DB', 'PGDATABASE') ?? 'postgres',
		user: pickEnvTrimmed(source, 'POSTGRES_USER', 'PGUSER') ?? 'postgres',
		password
	};
}

/** Résout la config Postgres à partir d’une source d’env (SvelteKit, process.env, dotenv…). */
export function getPostgresConfigFromEnv(source: DbEnvSource = processEnv): PostgresConfig {
	const credentials = resolveDbCredentials(source);
	if (!credentials) {
		throw new Error(
			'Configuration base de données manquante : définir POSTGRES_HOST + POSTGRES_PASSWORD'
		);
	}

	return {
		...credentials,
		ssl: sslFromEnv(source, credentials.host)
	};
}

/** Scripts CLI (migrate, drizzle-kit) : lit `process.env` après dotenv. */
export function getPostgresConfig(): PostgresConfig {
	return getPostgresConfigFromEnv(processEnv);
}

/** URL dérivée des variables d’environnement — pour drizzle-kit (`dbCredentials.url`). */
export function getDatabaseUrl(source: DbEnvSource = processEnv): string {
	const config = getPostgresConfigFromEnv(source);

	const base = `postgresql://${encodeURIComponent(config.user)}:${encodeURIComponent(config.password)}@${config.host}:${config.port}/${encodeURIComponent(config.database)}`;
	if (config.ssl === false) return base;
	const sep = base.includes('?') ? '&' : '?';
	return `${base}${sep}sslmode=require`;
}
