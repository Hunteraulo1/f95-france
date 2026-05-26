import type { AddTranslatorMode } from '$lib/components/dashboard/add-translator-mode';
import { db } from '$lib/server/db';
import { translator } from '$lib/server/db/schema';
import { EXTRACT_DRAFT_COOKIE, parseExtractDraftCookie } from '$lib/server/extract-draft';
import { assertGameManageAccess } from '$lib/server/game-manage-guard';
import { hasPermission } from '$lib/server/permissions';
import {
	assertRoleEditMode,
	getRoleEditMode,
	resolveShouldCreateSubmissionForUser
} from '$lib/server/role-edit-mode';
import type { PageServerLoad } from './$types';

function resolveAddTranslatorMode(params: {
	role: string | undefined;
	hasGamesManage: boolean;
	warnUnknownTranslators: boolean;
	usesSubmission: boolean;
}): AddTranslatorMode | false {
	const { role, hasGamesManage, warnUnknownTranslators, usesSubmission } = params;
	if (!role) return false;
	if (role === 'translator' || usesSubmission) return 'submission';
	if (hasGamesManage) {
		return warnUnknownTranslators ? 'direct' : 'submission';
	}
	return false;
}

export const load: PageServerLoad = async ({ locals, cookies }) => {
	await assertGameManageAccess(locals);
	if (locals.user?.role) {
		await assertRoleEditMode(locals.user.role);
	}

	try {
		const translators = await db.select().from(translator);
		const prefilledTranslator =
			locals.user?.id != null
				? (translators.find((t) => t.userId != null && t.userId === locals.user?.id) ?? null)
				: null;
		const role = locals.user?.role;
		const directModeActive = locals.user?.directMode ?? true;
		const hasGamesManage = hasPermission(locals, 'games.manage');
		const roleEditMode = hasGamesManage && role ? await getRoleEditMode(role) : null;
		const warnUnknownTranslators =
			hasGamesManage &&
			(roleEditMode === 'direct' || (roleEditMode === 'user_direct_mode' && directModeActive));
		const usesSubmission = locals.user
			? await resolveShouldCreateSubmissionForUser({
					roleSlug: role ?? 'user',
					userDirectMode: directModeActive
				})
			: true;
		const addTranslatorMode = resolveAddTranslatorMode({
			role,
			hasGamesManage,
			warnUnknownTranslators,
			usesSubmission
		});

		const extractDraft = parseExtractDraftCookie(cookies.get(EXTRACT_DRAFT_COOKIE));
		if (extractDraft) {
			cookies.delete(EXTRACT_DRAFT_COOKIE, { path: '/' });
		}

		return {
			translators,
			warnUnknownTranslators,
			addTranslatorMode,
			prefilledTranslatorName: prefilledTranslator?.name ?? null,
			extractDraft
		};
	} catch (error) {
		console.error('Error loading translators:', error);
		return {
			translators: [],
			warnUnknownTranslators: false,
			addTranslatorMode: false as const,
			prefilledTranslatorName: null,
			extractDraft: null
		};
	}
};
