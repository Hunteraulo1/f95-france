import { privateEnv } from '$lib/server/private-env';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { getPostgresConfigFromEnv, type PostgresConfig } from './connection';
import * as schema from './schema';

type AppDatabase = PostgresJsDatabase<typeof schema>;

function loadDbEnv(): Record<string, string | undefined> {
	return {
		POSTGRES_HOST: privateEnv('POSTGRES_HOST'),
		POSTGRES_PORT: privateEnv('POSTGRES_PORT'),
		POSTGRES_DB: privateEnv('POSTGRES_DB'),
		POSTGRES_USER: privateEnv('POSTGRES_USER'),
		POSTGRES_PASSWORD: privateEnv('POSTGRES_PASSWORD') ?? process.env.POSTGRES_PASSWORD,
		POSTGRES_SSL_MODE: privateEnv('POSTGRES_SSL_MODE'),
		DATABASE_URL: privateEnv('DATABASE_URL'),
		PGHOST: privateEnv('PGHOST'),
		PGPORT: privateEnv('PGPORT'),
		PGDATABASE: privateEnv('PGDATABASE'),
		PGUSER: privateEnv('PGUSER'),
		PGPASSWORD: privateEnv('PGPASSWORD') ?? process.env.PGPASSWORD,
		PGSSLMODE: privateEnv('PGSSLMODE')
	};
}

/**
 * Sur Vercel / serverless, le client `postgres` ne doit presque jamais ouvrir plusieurs
 * connexions simultanées : la valeur par défaut (max 10) saturerait vite le pool Neon
 * (erreur EMAXCONNSESSION / pool_size limité).
 */
function getPoolMax(): number {
	const raw = privateEnv('DATABASE_POOL_MAX');
	if (raw !== undefined) {
		const n = Number.parseInt(raw, 10);
		if (!Number.isNaN(n) && n >= 1) return Math.min(n, 32);
	}
	return process.env.VERCEL === '1' ? 1 : 10;
}

function createPostgresClient(config: PostgresConfig) {
	const max = getPoolMax();
	const options = {
		prepare: false,
		max,
		connect_timeout: 20
	} as const;

	return typeof config === 'string'
		? postgres(config, options)
		: postgres({ ...config, ...options });
}

const globalForDb = globalThis as unknown as {
	__f95PostgresClient?: ReturnType<typeof postgres>;
	__f95DrizzleDb?: AppDatabase;
};

function getOrCreateDb(): AppDatabase {
	if (!globalForDb.__f95DrizzleDb) {
		const config = getPostgresConfigFromEnv(loadDbEnv());
		const client = globalForDb.__f95PostgresClient ?? createPostgresClient(config);
		globalForDb.__f95PostgresClient = client;
		globalForDb.__f95DrizzleDb = drizzle(client, { schema });
	}
	return globalForDb.__f95DrizzleDb;
}

/** Connexion lazy : attend que SvelteKit ait injecté `$env/dynamic/private`. */
export const db = new Proxy({} as AppDatabase, {
	get(_target, prop, receiver) {
		const instance = getOrCreateDb();
		const value = Reflect.get(instance as object, prop, receiver);
		return typeof value === 'function' ? value.bind(instance) : value;
	}
});
