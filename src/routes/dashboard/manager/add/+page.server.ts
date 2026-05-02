import { db } from '$lib/server/db';
import { translator } from '$lib/server/db/schema';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	try {
		const translators = await db.select().from(translator);
		const prefilledTranslator =
			locals.user?.id != null
				? (translators.find((t) => t.userId != null && t.userId === locals.user?.id) ?? null)
				: null;
		const role = locals.user?.role;
		const directModeActive = locals.user?.directMode ?? true;
		const warnUnknownTranslators = role === 'admin' || (role === 'superadmin' && directModeActive);
		return {
			translators,
			warnUnknownTranslators,
			prefilledTranslatorName: prefilledTranslator?.name ?? null
		};
	} catch (error) {
		console.error('Error loading translators:', error);
		return { translators: [], warnUnknownTranslators: false, prefilledTranslatorName: null };
	}
};
