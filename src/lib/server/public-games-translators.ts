import { db } from '$lib/server/db';
import { translator } from '$lib/server/db/schema';
import { asc } from 'drizzle-orm';

export async function listTranslatorFilterOptions(): Promise<{ id: string; name: string }[]> {
	const rows = await db
		.select({ id: translator.id, name: translator.name })
		.from(translator)
		.orderBy(asc(translator.name));

	return rows.map((r) => ({ id: r.id, name: r.name?.trim() || 'Sans nom' }));
}
