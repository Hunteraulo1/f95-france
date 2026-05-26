import {
	isRoleEditMode,
	resolveShouldCreateSubmission,
	type RoleEditMode
} from '$lib/permissions/edit-mode';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';

const roleEditModeCache = new Map<string, { mode: RoleEditMode; expiresAt: number }>();
const CACHE_TTL_MS = 30_000;

const ROLE_EDIT_MODE_REQUIRED_MESSAGE =
	'Mode d’enregistrement du rôle non configuré ou invalide — accès refusé';

export function invalidateRoleEditModeCache(roleSlug?: string) {
	if (roleSlug) {
		roleEditModeCache.delete(roleSlug);
		return;
	}
	roleEditModeCache.clear();
}

/** Lit `edit_mode` en base ; `null` si absent, invalide ou erreur (aucun repli applicatif). */
export async function getRoleEditMode(roleSlug: string): Promise<RoleEditMode | null> {
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

		if (!row?.editMode || !isRoleEditMode(row.editMode)) {
			return null;
		}

		roleEditModeCache.set(roleSlug, { mode: row.editMode, expiresAt: Date.now() + CACHE_TTL_MS });
		return row.editMode;
	} catch {
		return null;
	}
}

export async function assertRoleEditMode(roleSlug: string): Promise<RoleEditMode> {
	const mode = await getRoleEditMode(roleSlug);
	if (!mode) {
		error(403, ROLE_EDIT_MODE_REQUIRED_MESSAGE);
	}
	return mode;
}

export async function resolveShouldCreateSubmissionForUser(params: {
	roleSlug: string;
	userDirectMode: boolean;
	requestDirectMode?: boolean;
}): Promise<boolean> {
	const roleEditMode = await assertRoleEditMode(params.roleSlug);

	if (roleEditMode === 'submission') return true;
	if (roleEditMode === 'direct') return false;

	const useDirectMode =
		params.requestDirectMode !== undefined ? params.requestDirectMode : params.userDirectMode;
	return resolveShouldCreateSubmission({ roleEditMode, useDirectMode });
}
