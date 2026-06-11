import { isSuperadminRole } from '$lib/permissions/catalog';
import {
	GAMES_MANAGE_PERMISSION,
	resolveEffectiveRoleEditMode,
	resolveShouldCreateSubmission,
	type RoleEditMode
} from '$lib/permissions/edit-mode';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { error } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';

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

async function roleHasGamesManage(roleSlug: string): Promise<boolean> {
	if (isSuperadminRole(roleSlug)) return true;

	try {
		const [row] = await db
			.select({ permissionKey: table.appRolePermission.permissionKey })
			.from(table.appRolePermission)
			.where(
				and(
					eq(table.appRolePermission.roleSlug, roleSlug),
					eq(table.appRolePermission.permissionKey, GAMES_MANAGE_PERMISSION)
				)
			)
			.limit(1);
		return Boolean(row);
	} catch {
		return false;
	}
}

/** Lit `edit_mode` effectif ; `null` sans `games.manage`, si absent, invalide ou erreur. */
export async function getRoleEditMode(roleSlug: string): Promise<RoleEditMode | null> {
	if (!(await roleHasGamesManage(roleSlug))) {
		return null;
	}

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

		const mode = resolveEffectiveRoleEditMode(row?.editMode, true);
		if (!mode) {
			return null;
		}

		roleEditModeCache.set(roleSlug, { mode, expiresAt: Date.now() + CACHE_TTL_MS });
		return mode;
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
