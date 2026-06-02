import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type postgres from 'postgres';
import { migrationFileHash } from './migration-hash';

const MIGRATIONS_SCHEMA = 'drizzle';
const MIGRATIONS_TABLE = '__drizzle_migrations';

/** Migrations Supabase-only (RLS PostgREST) : contenu inchangé en prod. */
export const SUPABASE_RLS_MIGRATION_TAGS = [
	'0008_rls_public_api_tables',
	'0009_revoke_anon_authenticated_api_tables',
	'0010_rls_deny_all_remaining_public_tables'
] as const;

type Journal = {
	entries: { tag: string; when: number }[];
};

export async function hasSupabaseApiRoles(client: postgres.Sql): Promise<boolean> {
	const [{ has_roles }] = await client<{ has_roles: boolean }[]>`
		SELECT
			EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
			AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') AS has_roles
	`;
	return has_roles;
}

async function lastAppliedMigrationWhen(client: postgres.Sql): Promise<number | null> {
	const [{ table_exists }] = await client<{ table_exists: boolean }[]>`
		SELECT EXISTS (
			SELECT 1
			FROM information_schema.tables
			WHERE table_schema = ${MIGRATIONS_SCHEMA}
				AND table_name = ${MIGRATIONS_TABLE}
		) AS table_exists
	`;
	if (!table_exists) return null;

	const rows = await client.unsafe<{ created_at: string }[]>(
		`SELECT created_at FROM "${MIGRATIONS_SCHEMA}"."${MIGRATIONS_TABLE}" ORDER BY created_at DESC LIMIT 1`
	);
	if (rows.length === 0) return null;
	return Number(rows[0].created_at);
}

function journalEntry(journal: Journal, tag: string) {
	const entry = journal.entries.find((e) => e.tag === tag);
	if (!entry) throw new Error(`Entrée journal introuvable: ${tag}`);
	return entry;
}

/**
 * Sur Postgres sans rôles Supabase, exécute l’équivalent RLS de 0008–0010 puis marque ces
 * migrations comme appliquées (même hash / created_at que drizzle migrate) pour ne pas
 * modifier les fichiers SQL versionnés ni casser la prod Supabase.
 */
export async function applyPlainPostgresRlsBypassIfNeeded(
	client: postgres.Sql,
	migrationsFolder: string
): Promise<void> {
	if (await hasSupabaseApiRoles(client)) return;

	const journalPath = resolve(migrationsFolder, 'meta/_journal.json');
	const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as Journal;
	const lastWhen = await lastAppliedMigrationWhen(client);
	const lastRlsWhen = journalEntry(journal, SUPABASE_RLS_MIGRATION_TAGS[2]).when;

	if (lastWhen !== null && lastWhen >= lastRlsWhen) return;

	const compatSqlPath = resolve(migrationsFolder, 'postgres/plain_postgres_rls_0008_0010.sql');
	console.log(
		'Postgres sans rôles Supabase : contournement RLS 0008–0010 (fichiers drizzle inchangés).'
	);
	await client.unsafe(readFileSync(compatSqlPath, 'utf8'));

	await client.unsafe(`CREATE SCHEMA IF NOT EXISTS "${MIGRATIONS_SCHEMA}"`);
	await client.unsafe(`
		CREATE TABLE IF NOT EXISTS "${MIGRATIONS_SCHEMA}"."${MIGRATIONS_TABLE}" (
			"id" SERIAL PRIMARY KEY,
			"hash" text NOT NULL,
			"created_at" bigint
		)
	`);

	for (const tag of SUPABASE_RLS_MIGRATION_TAGS) {
		const { when } = journalEntry(journal, tag);
		if (lastWhen !== null && lastWhen >= when) continue;

		const rows = await client.unsafe<{ exists: boolean }[]>(
			`SELECT EXISTS (
				SELECT 1 FROM "${MIGRATIONS_SCHEMA}"."${MIGRATIONS_TABLE}"
				WHERE created_at = ${when}
			) AS exists`
		);
		if (rows[0]?.exists) continue;

		const hash = migrationFileHash(migrationsFolder, tag);
		await client.unsafe(
			`INSERT INTO "${MIGRATIONS_SCHEMA}"."${MIGRATIONS_TABLE}" ("hash", "created_at") VALUES ('${hash}', ${when})`
		);
	}
}
