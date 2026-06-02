import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Hash SHA-256 du fichier SQL, identique à drizzle-orm/migrator et stamp-migrations. */
export function migrationFileHash(migrationsFolder: string, tag: string): string {
	const sqlPath = resolve(migrationsFolder, `${tag}.sql`);
	const query = readFileSync(sqlPath, 'utf8');
	return createHash('sha256').update(query).digest('hex');
}
