import { parseTranslatorPages } from '$lib/profile/custom-profile';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export async function loadTranslatorPagesForUser(userId: string) {
	const [row] = await db
		.select({
			id: table.translator.id,
			name: table.translator.name,
			pages: table.translator.pages
		})
		.from(table.translator)
		.where(eq(table.translator.userId, userId))
		.limit(1);

	if (!row) {
		return { translator: null, links: [] };
	}

	return {
		translator: { id: row.id, name: row.name },
		links: parseTranslatorPages(row.pages)
	};
}
