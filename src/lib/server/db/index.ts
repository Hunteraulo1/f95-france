import { privateEnv } from '$lib/server/private-env';
import { drizzle, type MySql2Database } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { getMariadbConfigFromEnv, type MariadbConfig } from './connection';
import * as schema from './schema';

type AppDatabase = MySql2Database<typeof schema>;

function loadDbEnv(): Record<string, string | undefined> {
	return {
		MARIADB_HOST: privateEnv('MARIADB_HOST'),
		MARIADB_PORT: privateEnv('MARIADB_PORT'),
		MARIADB_DATABASE: privateEnv('MARIADB_DATABASE'),
		MARIADB_USER: privateEnv('MARIADB_USER'),
		MARIADB_PASSWORD: privateEnv('MARIADB_PASSWORD') ?? process.env.MARIADB_PASSWORD,
		MARIADB_SSL_MODE: privateEnv('MARIADB_SSL_MODE')
	};
}

function getPoolMax(): number {
	const raw = privateEnv('DATABASE_POOL_MAX');
	if (raw !== undefined) {
		const n = Number.parseInt(raw, 10);
		if (!Number.isNaN(n) && n >= 1) return Math.min(n, 32);
	}
	return 10;
}

function createMysqlPool(config: MariadbConfig) {
	const max = getPoolMax();
	return mysql.createPool({
		host: config.host,
		port: config.port,
		database: config.database,
		user: config.user,
		password: config.password,
		ssl: config.ssl ? {} : undefined,
		waitForConnections: true,
		connectionLimit: max,
		connectTimeout: 20_000
	});
}

const globalForDb = globalThis as unknown as {
	__f95MysqlPool?: mysql.Pool;
	__f95DrizzleDb?: AppDatabase;
};

function getOrCreateDb(): AppDatabase {
	if (!globalForDb.__f95DrizzleDb) {
		const config = getMariadbConfigFromEnv(loadDbEnv());
		const pool = globalForDb.__f95MysqlPool ?? createMysqlPool(config);
		globalForDb.__f95MysqlPool = pool;
		globalForDb.__f95DrizzleDb = drizzle(pool, { schema, mode: 'default' });
	}
	return globalForDb.__f95DrizzleDb;
}

export const db = new Proxy({} as AppDatabase, {
	get(_target, prop, receiver) {
		const instance = getOrCreateDb();
		const value = Reflect.get(instance as object, prop, receiver);
		return typeof value === 'function' ? value.bind(instance) : value;
	}
});
