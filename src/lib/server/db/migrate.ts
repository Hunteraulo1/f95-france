import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/mysql2';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import mysql from 'mysql2/promise';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { getMariadbConfig } from './connection';

config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), '.env.local') });

const migrationsFolder = resolve(process.cwd(), 'drizzle');

async function runMigrations() {
	const clientConfig = getMariadbConfig();
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
	try {
		const journalPath = resolve(migrationsFolder, 'meta/_journal.json');
		console.log(
			`Démarrage des migrations… (cwd: ${process.cwd()}, dossier: ${migrationsFolder}, journal: ${existsSync(journalPath) ? 'ok' : 'manquant'}, host: ${clientConfig.host}:${clientConfig.port}/${clientConfig.database})`
		);
		if (!existsSync(journalPath)) {
			throw new Error(`Fichier journal introuvable: ${journalPath}`);
		}
		await migrate(db, {
			migrationsFolder,
			migrationsTable: '__drizzle_migrations'
		});
		console.log('Migrations terminées avec succès !');
		await connection.end();
		process.exit(0);
	} catch (error) {
		console.error('Erreur lors des migrations:', error);
		if (error && typeof error === 'object') {
			const e = error as Record<string, unknown>;
			if (typeof e.message === 'string') console.error('Détail:', e.message);
			if (typeof e.code === 'string') console.error('Code:', e.code);
		}
		await connection.end();
		process.exit(1);
	}
}

runMigrations();
