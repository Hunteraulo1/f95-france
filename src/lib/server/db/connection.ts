/**
 * Configuration de connexion Postgres.
 * Supporte soit DATABASE_URL, soit les variables PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD
 * (utile quand le mot de passe contient des caractères spéciaux : & # % ! ^ etc.)
 */
export type PostgresConfig =
	| string
	| {
			host: string;
			port: number;
			database: string;
			user: string;
			password: string;
			ssl?: boolean | 'require';
	  };

export function getPostgresConfig(env: Record<string, string | undefined>): PostgresConfig {
	const { PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD, DATABASE_URL } = env;

	if (PGHOST && PGPASSWORD !== undefined) {
		return {
			host: PGHOST,
			port: PGPORT ? parseInt(PGPORT, 10) : 5432,
			database: PGDATABASE ?? 'postgres',
			user: PGUSER ?? 'postgres',
			password: PGPASSWORD,
			ssl: 'require'
		};
	}

	if (DATABASE_URL) {
		return DATABASE_URL;
	}

	throw new Error(
		'Configuration base de données manquante : définir DATABASE_URL ou (PGHOST + PGPASSWORD, et optionnellement PGPORT, PGDATABASE, PGUSER)'
	);
}

/** URL pour drizzle-kit (dbCredentials.url) ; encode le mot de passe si on utilise PGHOST/PGPASSWORD. */
export function getDatabaseUrl(env: Record<string, string | undefined>): string {
	const { PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD, DATABASE_URL } = env;

	if (PGHOST && PGPASSWORD !== undefined) {
		const port = PGPORT ?? '5432';
		const database = PGDATABASE ?? 'postgres';
		const user = PGUSER ?? 'postgres';
		return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(PGPASSWORD)}@${PGHOST}:${port}/${encodeURIComponent(database)}`;
	}

	if (DATABASE_URL) {
		return DATABASE_URL;
	}

	throw new Error(
		'Configuration base de données manquante : définir DATABASE_URL ou PGHOST + PGPASSWORD'
	);
}
