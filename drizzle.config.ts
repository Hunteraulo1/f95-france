import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';
import { getMariadbUrl } from './src/lib/server/db/connection';

/**
 * Migrations : modifier uniquement `src/lib/server/db/schema.ts`, puis `db:generate` + `db:migrate`.
 * Ne pas créer de SQL à la main dans `drizzle/`. Voir `.cursor/rules/drizzle-migrations.mdc`.
 *
 * drizzle-kit push/pull/introspect : connexion **directe** MariaDB (port 3306).
 */

export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	dialect: 'mysql',
	dbCredentials: { url: getMariadbUrl() },
	out: './drizzle',
	verbose: true,
	strict: true,
	migrations: {
		table: '__drizzle_migrations'
	}
});
