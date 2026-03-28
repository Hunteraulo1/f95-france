import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
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

async function runMigrations() {
	try {
		console.log('Démarrage des migrations...');
		await migrate(db, { migrationsFolder: './drizzle' });
		console.log('Migrations terminées avec succès !');
		await client.end({ timeout: 5 });
		process.exit(0);
	} catch (error) {
		console.error('Erreur lors des migrations:', error);
		await client.end({ timeout: 5 });
		process.exit(1);
	}
}

runMigrations();
