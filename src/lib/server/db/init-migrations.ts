import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';
import { config } from 'dotenv';
import { resolve } from 'path';
import { getPostgresConfig } from './connection';

// Charger les variables d'environnement depuis .env
config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), '.env.local') });

const clientConfig = getPostgresConfig(process.env);
const client =
	typeof clientConfig === 'string'
		? postgres(clientConfig, { prepare: false })
		: postgres(clientConfig);
const db = drizzle(client);

async function initMigrations() {
	try {
		console.log('Initialisation de la table de migrations...');

		// Créer la table de migrations si elle n'existe pas (format exact de Drizzle)
		await db.execute(sql`
			CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
				"id" SERIAL PRIMARY KEY,
				"hash" text NOT NULL UNIQUE,
				"created_at" bigint
			)
		`);

		// Marquer toutes les migrations existantes comme appliquées
		const migrations = [
			{ hash: '0000_careless_giant_man', createdAt: 1763267198480 },
			{ hash: '0001_dizzy_liz_osborn', createdAt: 1763373901200 },
			{ hash: '0002_careless_shooting_star', createdAt: 1763387616337 },
			{ hash: '0003_mean_pete_wisdom', createdAt: 1763466884701 },
			{ hash: '0004_open_black_panther', createdAt: 1763471169988 }
		];

		for (const migration of migrations) {
			await db.execute(sql`
				INSERT INTO "__drizzle_migrations" ("hash", "created_at")
				VALUES (${migration.hash}, ${migration.createdAt})
				ON CONFLICT ("hash") DO NOTHING
			`);
			console.log(`✓ Migration ${migration.hash} vérifiée`);
		}

		console.log('Initialisation terminée avec succès !');
		await client.end({ timeout: 5 });
		process.exit(0);
	} catch (error) {
		console.error("Erreur lors de l'initialisation:", error);
		await client.end({ timeout: 5 });
		process.exit(1);
	}
}

initMigrations();
