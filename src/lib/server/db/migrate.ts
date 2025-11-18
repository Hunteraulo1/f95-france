import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import { config } from 'dotenv';
import { resolve } from 'path';

// Charger les variables d'environnement depuis .env
config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), '.env.local') });

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

const client = mysql.createPool(process.env.DATABASE_URL);
const db = drizzle(client);

async function runMigrations() {
	try {
		console.log('Démarrage des migrations...');
		await migrate(db, { migrationsFolder: './drizzle' });
		console.log('Migrations terminées avec succès !');
		await client.end();
		process.exit(0);
	} catch (error) {
		console.error('Erreur lors des migrations:', error);
		await client.end();
		process.exit(1);
	}
}

runMigrations();
