import {
	isRoleEditMode,
	legacyEditModeForRoleSlug,
	resolveShouldCreateSubmission,
	type RoleEditMode
} from '$lib/permissions/edit-mode';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

const roleEditModeCache = new Map<string, { mode: RoleEditMode; expiresAt: number }>();
const CACHE_TTL_MS = 30_000;

export function invalidateRoleEditModeCache(roleSlug?: string) {
	if (roleSlug) {
		roleEditModeCache.delete(roleSlug);
		return;
	}
	roleEditModeCache.clear();
}

export async function getRoleEditMode(roleSlug: string): Promise<RoleEditMode> {
	const cached = roleEditModeCache.get(roleSlug);
	if (cached && Date.now() <= cached.expiresAt) {
		return cached.mode;
	}

	try {
		const [row] = await db
			.select({ editMode: table.appRole.editMode })
			.from(table.appRole)
			.where(eq(table.appRole.slug, roleSlug))
			.limit(1);

		const mode =
			row?.editMode && isRoleEditMode(row.editMode)
				? row.editMode
				: legacyEditModeForRoleSlug(roleSlug);

		roleEditModeCache.set(roleSlug, { mode, expiresAt: Date.now() + CACHE_TTL_MS });
		return mode;
	} catch {
		return legacyEditModeForRoleSlug(roleSlug);
	}
}

export async function resolveShouldCreateSubmissionForUser(params: {
	roleSlug: string;
	userDirectMode: boolean;
	requestDirectMode?: boolean;
}): Promise<boolean> {
	const roleEditMode = await getRoleEditMode(params.roleSlug);

	// Rôles « soumission » ou « direct » : le client ne peut pas outrepasser la politique du rôle.
	if (roleEditMode === 'submission') return true;
	if (roleEditMode === 'direct') return false;

	const useDirectMode =
		params.requestDirectMode !== undefined ? params.requestDirectMode : params.userDirectMode;
	return resolveShouldCreateSubmission({ roleEditMode, useDirectMode });
}
