import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';
import { getDatabaseUrl } from './src/lib/server/db/connection';

/**
 * drizzle-kit push/pull/introspect : préférer une connexion **directe** Postgres (port 5432),
 * pas le pooler PgBouncer (ex. Supabase :6543). Sinon l’étape « Pulling schema » peut rester
 * bloquée très longtemps ou sembler infinie.
 */

function withConnectTimeout(url: string, seconds: number): string {
	if (/\bconnect_timeout=/.test(url)) return url;
	const sep = url.includes('?') ? '&' : '?';
	return `${url}${sep}connect_timeout=${seconds}`;
}

export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	dialect: 'postgresql',
	dbCredentials: { url: withConnectTimeout(getDatabaseUrl(), 30) },
	out: './drizzle',
	verbose: true,
	strict: true,
	schemaFilter: ['public'],
	migrations: {
		table: '__drizzle_migrations'
	}
});
