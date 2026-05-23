import { db } from '$lib/server/db';
import { translator } from '$lib/server/db/schema';
import { EXTRACT_DRAFT_COOKIE, parseExtractDraftCookie } from '$lib/server/extract-draft';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, cookies }) => {
	try {
		const translators = await db.select().from(translator);
		const prefilledTranslator =
			locals.user?.id != null
				? (translators.find((t) => t.userId != null && t.userId === locals.user?.id) ?? null)
				: null;
		const role = locals.user?.role;
		const directModeActive = locals.user?.directMode ?? true;
		const warnUnknownTranslators = role === 'admin' || (role === 'superadmin' && directModeActive);

		const extractDraft = parseExtractDraftCookie(cookies.get(EXTRACT_DRAFT_COOKIE));
		if (extractDraft) {
			cookies.delete(EXTRACT_DRAFT_COOKIE, { path: '/' });
		}

		return {
			translators,
			warnUnknownTranslators,
			prefilledTranslatorName: prefilledTranslator?.name ?? null,
			extractDraft
		};
	} catch (error) {
		console.error('Error loading translators:', error);
		return {
			translators: [],
			warnUnknownTranslators: false,
			prefilledTranslatorName: null,
			extractDraft: null
		};
	}
};
