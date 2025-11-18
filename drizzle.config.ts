import { defineConfig } from 'drizzle-kit';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	dialect: 'mysql',
	dbCredentials: { url: process.env.DATABASE_URL },
	out: './drizzle',
	verbose: true,
	strict: true,
	migrations: {
		table: '__drizzle_migrations'
	}
});
