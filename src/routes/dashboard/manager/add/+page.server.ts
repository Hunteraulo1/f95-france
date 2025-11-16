import { db } from '$lib/server/db';
import { translator } from '$lib/server/db/schema';

export const load = async () => {
	try {
		const translators = await db.select().from(translator);
		return { translators };
	} catch (error) {
		console.error('Error loading translators:', error);
		return { translators: [] };
	}
};
