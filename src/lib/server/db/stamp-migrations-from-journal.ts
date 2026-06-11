import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getMariadbConfig } from './connection';
import { migrationFileHash } from './migration-hash';

config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), '.env.local') });

const MIGRATIONS_TABLE = '__drizzle_migrations';

type Journal = {
	entries: { tag: string; when: number }[];
};

const clientConfig = getMariadbConfig();

async function stampMigrationsFromJournal() {
	const connection = await mysql.createConnection({
		host: clientConfig.host,
		port: clientConfig.port,
		database: clientConfig.database,
		user: clientConfig.user,
		password: clientConfig.password,
		ssl: clientConfig.ssl ? {} : undefined,
		connectTimeout: 20_000
	});
	const db = drizzle(connection);

	const migrationsFolder = resolve(process.cwd(), 'drizzle');
	const journalPath = resolve(process.cwd(), 'drizzle/meta/_journal.json');
	const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as Journal;

	if (!journal.entries?.length) {
		throw new Error('Journal Drizzle vide ou invalide');
	}

	await db.execute(
		mysql.format(`
			CREATE TABLE IF NOT EXISTS \`${MIGRATIONS_TABLE}\` (
				\`id\` int NOT NULL AUTO_INCREMENT,
				\`hash\` varchar(256),
				\`created_at\` bigint,
				PRIMARY KEY (\`id\`)
			)
		`)
	);
	await db.execute(mysql.format(`TRUNCATE TABLE \`${MIGRATIONS_TABLE}\``));

	for (const entry of journal.entries) {
		const hash = migrationFileHash(migrationsFolder, entry.tag);
		await db.execute(
			mysql.format(`INSERT INTO \`${MIGRATIONS_TABLE}\` (\`hash\`, \`created_at\`) VALUES (?, ?)`, [
				hash,
				entry.when
			])
		);
	}

	const latest = journal.entries.reduce(
		(max, e) => (e.when > max.when ? e : max),
		journal.entries[0]
	);
	console.log(`Migrations marquées : ${journal.entries.length} (dernière : ${latest.tag}).`);

	await connection.end();
}

stampMigrationsFromJournal()
	.then(() => process.exit(0))
	.catch(async (error) => {
		console.error('Erreur lors du marquage des migrations:', error);
		process.exit(1);
	});
