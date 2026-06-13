#!/usr/bin/env bun
/**
 * Migration one-shot : PostgreSQL (prod) → MariaDB.
 *
 * Variables d'env source (PostgreSQL) :
 *   DATABASE_URL=postgresql://user:pass@host:port/db  (prioritaire)
 *   ou PG_HOST, PG_PORT (5432), PG_DATABASE, PG_USER, PG_PASSWORD, PG_SSL_MODE (require|disable)
 *
 * Variables d'env cible (MariaDB) :
 *   TO_MARIADB_HOST, TO_MARIADB_PORT (3306), TO_MARIADB_DATABASE, TO_MARIADB_USER, TO_MARIADB_PASSWORD, TO_MARIADB_SSL_MODE (require|disable)
 *
 * Usage :
 *   bun scripts/migrate-postgres-to-mariadb.ts [--yes] [--skip-ephemeral]
 *   bun scripts/migrate-postgres-to-mariadb.ts --tables game,game_translation
 */

import pg from 'pg';
import mysql from 'mysql2/promise';
import readline from 'readline';

type Row = Record<string, unknown>;

// ─── Env ─────────────────────────────────────────────────────────────────────
// Bun charge .env automatiquement — pas besoin de dotenv.

function pgConfig(): pg.PoolConfig {
	const url = process.env.DATABASE_URL ?? process.env.PG_URL;
	if (url) {
		const noSsl = url.includes('sslmode=disable') || url.includes('ssl=false');
		return {
			connectionString: url,
			ssl: noSsl ? false : { rejectUnauthorized: false }
		};
	}

	const host = process.env.PG_HOST ?? process.env.POSTGRES_HOST;
	const port = Number(process.env.PG_PORT ?? process.env.POSTGRES_PORT ?? 5432);
	const database =
		process.env.PG_DATABASE ?? process.env.POSTGRES_DB ?? process.env.POSTGRES_DATABASE;
	const user = process.env.PG_USER ?? process.env.POSTGRES_USER;
	const password = process.env.PG_PASSWORD ?? process.env.POSTGRES_PASSWORD;
	const sslMode = process.env.PG_SSL_MODE ?? process.env.PG_SSL ?? process.env.POSTGRES_SSL ?? 'require';

	if (!host || !database || !user) {
		console.error('❌  Config PostgreSQL manquante.');
		console.error('   Définir dans .env : DATABASE_URL=postgresql://...');
		console.error('   ou PG_HOST, PG_DATABASE, PG_USER, PG_PASSWORD');
		process.exit(1);
	}

	return {
		host,
		port,
		database,
		user,
		password,
		ssl: sslMode === 'disable' ? false : { rejectUnauthorized: false }
	};
}

function mysqlConfig(): mysql.PoolOptions {
	const host = process.env.TO_MARIADB_HOST;
	const port = Number(process.env.TO_MARIADB_PORT ?? 3306);
	const database = process.env.TO_MARIADB_DATABASE;
	const user = process.env.TO_MARIADB_USER;
	const password = process.env.TO_MARIADB_PASSWORD ?? '';
	const sslMode = process.env.TO_MARIADB_SSL_MODE ?? 'require';

	if (!host || !database || !user) {
		console.error('❌  Config MariaDB manquante.');
		console.error(
			'   Définir dans .env : TO_MARIADB_HOST, TO_MARIADB_DATABASE, TO_MARIADB_USER, TO_MARIADB_PASSWORD'
		);
		process.exit(1);
	}

	return {
		host,
		port,
		database,
		user,
		password,
		ssl: sslMode === 'disable' ? undefined : { rejectUnauthorized: false },
		waitForConnections: true
	};
}

// ─── Conversion de types PostgreSQL → MariaDB ─────────────────────────────────
// pg retourne : boolean JS pour bool, Date JS pour timestamp, objet JS pour jsonb/array.

function convertRow(row: Row): Row {
	const out: Row = {};
	for (const [key, val] of Object.entries(row)) {
		if (val === null || val === undefined) {
			out[key] = null;
		} else if (typeof val === 'boolean') {
			// boolean → tinyint(1)
			out[key] = val ? 1 : 0;
		} else if (val instanceof Date) {
			// timestamptz → datetime (UTC, sans timezone)
			out[key] = val.toISOString().replace('T', ' ').slice(0, 19);
		} else if (typeof val === 'object') {
			// jsonb ou tableau PostgreSQL → JSON string
			out[key] = JSON.stringify(val);
		} else {
			out[key] = val;
		}
	}
	return out;
}

// ─── Tables dans l'ordre d'insertion (FK-safe) ───────────────────────────────

const ALL_TABLES = [
	// Sans dépendances
	'config',
	'app_permission',
	'app_role',
	'app_log',
	'game',
	// Dépend de app_role + app_permission
	'app_role_permission',
	// Dépend de user (pas encore, défini après)
	'user',
	'translator',
	'session',
	'passkey',
	'passkey_challenge',
	'login_throttle',
	'api_key',
	'api_key_rate',
	'email_verification_token',
	'password_reset_token',
	'notification',
	'api_log',
	// Dépend de game
	'game_translation',
	'update',
	// Dépend de plusieurs tables
	'submission',
	'update_history'
] as const;

// Tables éphémères que l'on peut ignorer sans perte de données métier
const EPHEMERAL_TABLES = new Set([
	'session',
	'passkey_challenge',
	'login_throttle',
	'email_verification_token',
	'password_reset_token',
	'api_key_rate'
]);

// ─── Parsing des arguments CLI ────────────────────────────────────────────────

const args = process.argv.slice(2);
const YES_MODE = args.includes('--yes') || args.includes('-y');
const SKIP_EPHEMERAL = args.includes('--skip-ephemeral');
const tablesArg = args.find((a) => a.startsWith('--tables='))?.slice('--tables='.length);
const BATCH_SIZE = Number(
	args.find((a) => a.startsWith('--batch='))?.slice('--batch='.length) ?? 1000
);

const tablesToMigrate: string[] = tablesArg
	? tablesArg.split(',').map((t) => t.trim())
	: SKIP_EPHEMERAL
		? ALL_TABLES.filter((t) => !EPHEMERAL_TABLES.has(t))
		: [...ALL_TABLES];

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function confirm(question: string): Promise<boolean> {
	const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
	return new Promise((resolve) => {
		rl.question(question, (ans) => {
			rl.close();
			resolve(ans.trim().toLowerCase() === 'yes');
		});
	});
}

function fmt(n: number): string {
	return n.toLocaleString('fr-FR');
}

// ─── Migration d'une table ────────────────────────────────────────────────────

async function migrateTable(
	pgPool: pg.Pool,
	conn: mysql.PoolConnection,
	table: string
): Promise<number> {
	// Vérifier que la table existe dans PostgreSQL
	const existsRes = await pgPool.query<{ exists: boolean }>(
		`SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = $1
    )`,
		[table]
	);
	if (!existsRes.rows[0]?.exists) {
		console.log(`  ${table}: absente dans PostgreSQL, ignorée.`);
		return 0;
	}

	const countRes = await pgPool.query<{ count: string }>(`SELECT COUNT(*) FROM "${table}"`);
	const total = parseInt(countRes.rows[0].count);

	if (total === 0) {
		await conn.query(`TRUNCATE TABLE \`${table}\``);
		console.log(`  ${table}: vide.`);
		return 0;
	}

	await conn.query(`TRUNCATE TABLE \`${table}\``);

	let inserted = 0;
	let offset = 0;

	// Récupérer les colonnes de la table
	const colsRes = await pgPool.query<{ column_name: string }>(
		`SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1
     ORDER BY ordinal_position`,
		[table]
	);
	const columns = colsRes.rows.map((r) => r.column_name);
	const colsSql = columns.map((c) => `"${c}"`).join(', ');
	const targetCols = columns.map((c) => `\`${c}\``).join(', ');

	while (inserted < total) {
		const res = await pgPool.query<Row>(`SELECT ${colsSql} FROM "${table}" OFFSET $1 LIMIT $2`, [
			offset,
			BATCH_SIZE
		]);
		if (res.rows.length === 0) break;

		const rows = res.rows.map(convertRow);
		const placeholders = rows.map(() => `(${columns.map(() => '?').join(', ')})`).join(', ');
		const values = rows.flatMap((r) => columns.map((c) => r[c] ?? null));

		await conn.query(`INSERT INTO \`${table}\` (${targetCols}) VALUES ${placeholders}`, values);

		inserted += rows.length;
		offset += BATCH_SIZE;
		process.stdout.write(
			`\r  ${table}: ${fmt(inserted)}/${fmt(total)} (${Math.round((inserted / total) * 100)}%)   `
		);
	}

	console.log(`\r  ${table}: ✓ ${fmt(inserted)} lignes.            `);
	return inserted;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
	console.log('╔══════════════════════════════════════════╗');
	console.log('║  Migration PostgreSQL → MariaDB           ║');
	console.log('╚══════════════════════════════════════════╝\n');

	const pgCfg = pgConfig();
	const mqCfg = mysqlConfig();

	// Résumé de la config
	const pgLabel = pgCfg.connectionString
		? pgCfg.connectionString.replace(/:\/\/[^@]+@/, '://***@')
		: `${pgCfg.host}:${pgCfg.port ?? 5432}/${pgCfg.database}`;
	const mqLabel = `${mqCfg.host}:${mqCfg.port ?? 3306}/${mqCfg.database}`;

	console.log(`Source  (PostgreSQL) : ${pgLabel}`);
	console.log(`Cible   (MariaDB)    : ${mqLabel}`);
	console.log(`Tables (${tablesToMigrate.length})         : ${tablesToMigrate.join(', ')}\n`);

	const pgPool = new pg.Pool(pgCfg);
	const mysqlPool = await mysql.createPool(mqCfg);

	// Test des connexions
	await pgPool.query('SELECT 1').catch((e: Error) => {
		console.error('❌  Connexion PostgreSQL échouée:', e.message);
		process.exit(1);
	});
	const conn = await mysqlPool.getConnection().catch((e: Error) => {
		console.error('❌  Connexion MariaDB échouée:', e.message);
		process.exit(1);
	});

	console.log('✓ Connexions OK\n');

	if (!YES_MODE) {
		const ok = await confirm('⚠️  Cette opération ÉCRASE les tables cibles. Continuer ? (yes/no) ');
		if (!ok) {
			console.log('Annulé.');
			await pgPool.end();
			conn.release();
			await mysqlPool.end();
			process.exit(0);
		}
		console.log();
	}

	// Désactiver les contraintes FK pour l'import
	await conn.query('SET FOREIGN_KEY_CHECKS=0');
	await conn.query("SET SESSION sql_mode = 'NO_ENGINE_SUBSTITUTION'");

	const stats: { table: string; count: number; error?: string }[] = [];
	const startedAt = Date.now();

	for (const table of tablesToMigrate) {
		try {
			const count = await migrateTable(pgPool, conn, table);
			stats.push({ table, count });
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			console.error(`\n  ❌  ${table}: ${msg}`);
			stats.push({ table, count: 0, error: msg });
		}
	}

	await conn.query('SET FOREIGN_KEY_CHECKS=1');
	conn.release();
	await pgPool.end();
	await mysqlPool.end();

	const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
	const totalRows = stats.reduce((s, r) => s + r.count, 0);
	const errors = stats.filter((r) => r.error);

	console.log(`\n${'─'.repeat(50)}`);
	console.log(`✅ Migration terminée en ${elapsed}s — ${fmt(totalRows)} lignes au total`);
	if (errors.length > 0) {
		console.log(`\n⚠️  ${errors.length} table(s) en erreur :`);
		for (const { table, error } of errors) console.log(`   ${table}: ${error}`);
	}
	console.log(`\n💡 Lance ensuite : bun run db:migrate`);
	console.log(`   (pour appliquer les migrations MariaDB manquantes)\n`);
}

main().catch((e) => {
	console.error('Erreur fatale:', e);
	process.exit(1);
});
