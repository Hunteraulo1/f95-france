import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { resolve } from 'path';
import postgres from 'postgres';
import { getPostgresConfig } from './connection';

// Charger les variables d'environnement depuis .env
config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), '.env.local') });

async function runMigrations() {
	const clientConfig = getPostgresConfig();
	const client = postgres({ ...clientConfig, prepare: false, connect_timeout: 20 });
	const db = drizzle(client);
	try {
		console.log(
			`Démarrage des migrations… (${clientConfig.host}:${clientConfig.port}/${clientConfig.database}, ssl=${clientConfig.ssl === 'require' || clientConfig.ssl === true})`
		);
		// Sur une base déjà peuplée, ADD CONSTRAINT (FK) valide toute la table et peut dépasser
		// le statement_timeout du fournisseur (ex. Neon ~2 min) → erreur 57014.
		await client.unsafe('SET statement_timeout = 0');
		await migrate(db, {
			migrationsFolder: './drizzle',
			migrationsSchema: 'drizzle',
			migrationsTable: '__drizzle_migrations'
		});
		console.log('Migrations terminées avec succès !');
		await client.end({ timeout: 5 });
		process.exit(0);
	} catch (error) {
		console.error('Erreur lors des migrations:', error);
		if (error && typeof error === 'object') {
			const e = error as Record<string, unknown>;
			if (typeof e.message === 'string') console.error('Détail:', e.message);
			if (typeof e.code === 'string') console.error('Code:', e.code);
		}
		await client.end({ timeout: 5 });
		process.exit(1);
	}
}

runMigrations();
