import { config } from 'dotenv';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postgres from 'postgres';
import { getPostgresConfig } from './connection';

config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), '.env.local') });

/** Aligné sur drizzle-orm/pg-core/dialect.js (défaut migrate). */
const MIGRATIONS_SCHEMA = 'drizzle';
const MIGRATIONS_TABLE = '__drizzle_migrations';

type Journal = {
	entries: { tag: string; when: number }[];
};

const clientConfig = getPostgresConfig();
const client = postgres({ ...clientConfig, prepare: false, connect_timeout: 20 });
const db = drizzle(client);

function migrationHash(tag: string): string {
	const sqlPath = resolve(process.cwd(), `drizzle/${tag}.sql`);
	const query = readFileSync(sqlPath, 'utf8');
	return createHash('sha256').update(query).digest('hex');
}

async function stampMigrationsFromJournal() {
	const journalPath = resolve(process.cwd(), 'drizzle/meta/_journal.json');
	const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as Journal;

	if (!journal.entries?.length) {
		throw new Error('Journal Drizzle vide ou invalide');
	}

	await db.execute(sql.raw('DROP TABLE IF EXISTS public.__drizzle_migrations'));
	await db.execute(sql.raw(`CREATE SCHEMA IF NOT EXISTS "${MIGRATIONS_SCHEMA}"`));
	await db.execute(
		sql.raw(`
		CREATE TABLE IF NOT EXISTS "${MIGRATIONS_SCHEMA}"."${MIGRATIONS_TABLE}" (
			"id" SERIAL PRIMARY KEY,
			"hash" text NOT NULL,
			"created_at" bigint
		)
	`)
	);
	await db.execute(
		sql.raw(`TRUNCATE TABLE "${MIGRATIONS_SCHEMA}"."${MIGRATIONS_TABLE}" RESTART IDENTITY`)
	);

	for (const entry of journal.entries) {
		const hash = migrationHash(entry.tag);
		await db.execute(sql`
			INSERT INTO ${sql.identifier(MIGRATIONS_SCHEMA)}.${sql.identifier(MIGRATIONS_TABLE)} ("hash", "created_at")
			VALUES (${hash}, ${entry.when})
		`);
	}

	const latest = journal.entries.reduce(
		(max, e) => (e.when > max.when ? e : max),
		journal.entries[0]
	);
	console.log(
		`Migrations marquées : ${journal.entries.length} (schéma ${MIGRATIONS_SCHEMA}, dernière : ${latest.tag}).`
	);
}

stampMigrationsFromJournal()
	.then(async () => {
		await client.end({ timeout: 5 });
		process.exit(0);
	})
	.catch(async (error) => {
		console.error('Erreur lors du marquage des migrations:', error);
		await client.end({ timeout: 5 });
		process.exit(1);
	});
