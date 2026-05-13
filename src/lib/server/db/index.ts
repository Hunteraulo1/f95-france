import { env } from '$env/dynamic/private';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { getPostgresConfig, type PostgresConfig } from './connection';
import * as schema from './schema';

/**
 * Pendant `vite build`, `$env/dynamic/private` peut être vide avant que SvelteKit
 * appelle `set_private_env` ; on retombe sur `process.env` (ex. `ENV` dans le Dockerfile).
 */
function privateEnv(key: string): string | undefined {
	const fromKit = env[key as keyof typeof env];
	if (typeof fromKit === 'string') return fromKit;
	return process.env[key];
}

const envForDb = new Proxy({} as Record<string, string | undefined>, {
	get(_, prop: string | symbol) {
		if (typeof prop !== 'string') return undefined;
		return privateEnv(prop);
	}
});

/**
 * Sur Vercel / serverless, le client `postgres` ne doit presque jamais ouvrir plusieurs
 * connexions simultanées : la valeur par défaut (max 10) saturerait vite le pool Neon
 * (erreur EMAXCONNSESSION / pool_size limité).
 */
function getPoolMax(): number {
	const raw = privateEnv('DATABASE_POOL_MAX');
	if (raw !== undefined && raw !== '') {
		const n = parseInt(raw, 10);
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

const globalForDb = globalThis as unknown as { __f95PostgresClient?: ReturnType<typeof postgres> };

const config = getPostgresConfig(envForDb);
const client = globalForDb.__f95PostgresClient ?? createPostgresClient(config);
globalForDb.__f95PostgresClient = client;

export const db = drizzle(client, { schema });
