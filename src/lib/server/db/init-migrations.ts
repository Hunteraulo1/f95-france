import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { sql } from 'drizzle-orm';
import { config } from 'dotenv';
import { resolve } from 'path';

// Charger les variables d'environnement depuis .env
config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), '.env.local') });

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

const client = mysql.createPool(process.env.DATABASE_URL);
const db = drizzle(client);

async function initMigrations() {
	try {
		console.log('Initialisation de la table de migrations...');
		
		// Créer la table de migrations si elle n'existe pas (format exact de Drizzle)
		await db.execute(sql`
			CREATE TABLE IF NOT EXISTS \`__drizzle_migrations\` (
				\`id\` SERIAL PRIMARY KEY,
				\`hash\` text NOT NULL,
				\`created_at\` bigint
			) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
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
			// Vérifier si la migration existe déjà
			const result = await db.execute(sql`
				SELECT COUNT(*) as count FROM \`__drizzle_migrations\` 
				WHERE \`hash\` = ${migration.hash}
			`) as Array<Array<{ count: number }>>;
			
			const count = Number(result[0]?.[0]?.count) || 0;
			
			if (count === 0) {
				await db.execute(sql`
					INSERT INTO \`__drizzle_migrations\` (\`hash\`, \`created_at\`)
					VALUES (${migration.hash}, ${migration.createdAt})
				`);
				console.log(`✓ Migration ${migration.hash} marquée comme appliquée`);
			} else {
				console.log(`- Migration ${migration.hash} déjà marquée comme appliquée`);
			}
		}

		console.log('Initialisation terminée avec succès !');
		await client.end();
		process.exit(0);
	} catch (error) {
		console.error('Erreur lors de l\'initialisation:', error);
		await client.end();
		process.exit(1);
	}
}

initMigrations();
