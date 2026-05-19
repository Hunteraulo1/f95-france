import { env as processEnv } from 'node:process';

/**
 * Configuration de connexion Postgres.
 * (utile quand le mot de passe contient des caractères spéciaux : & # % ! ^ etc.)
 */
export type PostgresConfig =
	| string
	| {
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

/** `POSTGRES_SSL_MODE=disable` en local ; `require` pour Supabase/Neon/etc. si non précisé. */
function sslFromEnv(source: DbEnvSource, host: string): boolean | 'require' {
	const m = pickEnv(source, 'POSTGRES_SSL_MODE', 'PGSSLMODE')?.toLowerCase();
	if (m === 'disable') return false;
	if (m === 'require' || m === 'verify-full' || m === 'verify-ca') return 'require';
	if (m === 'prefer' || m === 'allow') return 'require';
	if (isLocalPostgresHost(host)) return false;
	return 'require';
}

function configFromDatabaseUrl(url: string): PostgresConfig | null {
	try {
		const parsed = new URL(url);
		if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') return null;
		const host = parsed.hostname;
		if (!host) return null;
		const password = parsed.password ? decodeURIComponent(parsed.password) : '';
		return {
			host,
			port: parsed.port ? Number.parseInt(parsed.port, 10) : 5432,
			database: parsed.pathname.replace(/^\//, '') || 'postgres',
			user: parsed.username ? decodeURIComponent(parsed.username) : 'postgres',
			password,
			ssl: sslFromEnv(sourceFromUrl(parsed), host)
		};
	} catch {
		return null;
	}
}

function sourceFromUrl(parsed: URL): DbEnvSource {
	return {
		POSTGRES_SSL_MODE: parsed.searchParams.get('sslmode') ?? undefined
	};
}

function resolveDbCredentials(source: DbEnvSource): {
	host: string;
	port: number;
	database: string;
	user: string;
	password: string;
} | null {
	const databaseUrl = pickEnvTrimmed(source, 'DATABASE_URL');
	if (databaseUrl) {
		const fromUrl = configFromDatabaseUrl(databaseUrl);
		if (fromUrl && typeof fromUrl !== 'string') {
			return {
				host: fromUrl.host,
				port: fromUrl.port,
				database: fromUrl.database,
				user: fromUrl.user,
				password: fromUrl.password
			};
		}
	}

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
			'Configuration base de données manquante : définir POSTGRES_HOST + POSTGRES_PASSWORD (ou DATABASE_URL, ou PGHOST + PGPASSWORD)'
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

/** URL pour drizzle-kit (dbCredentials.url). */
export function getDatabaseUrl(source: DbEnvSource = processEnv): string {
	const config = getPostgresConfigFromEnv(source);
	if (typeof config === 'string') return config;

	const base = `postgresql://${encodeURIComponent(config.user)}:${encodeURIComponent(config.password)}@${config.host}:${config.port}/${encodeURIComponent(config.database)}`;
	if (config.ssl === false) return base;
	const sep = base.includes('?') ? '&' : '?';
	return `${base}${sep}sslmode=require`;
}
