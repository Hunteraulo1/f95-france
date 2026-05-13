import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

/**
 * drizzle-kit push/pull/introspect : préférer une connexion **directe** Postgres (port 5432),
 * pas le pooler PgBouncer (ex. Supabase :6543). Sinon l’étape « Pulling schema » peut rester
 * bloquée très longtemps ou sembler infinie.
 */
const rawUrl = process.env.DATABASE_URL;
if (!rawUrl) {
	throw new Error('Définir DATABASE_URL pour drizzle-kit');
}

function withConnectTimeout(url: string, seconds: number): string {
	if (/\bconnect_timeout=/.test(url)) return url;
	const sep = url.includes('?') ? '&' : '?';
	return `${url}${sep}connect_timeout=${seconds}`;
}

export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	dialect: 'postgresql',
	dbCredentials: { url: withConnectTimeout(rawUrl, 30) },
	out: './drizzle',
	verbose: true,
	strict: true,
	schemaFilter: ['public'],
	migrations: {
		table: '__drizzle_migrations'
	}
});
