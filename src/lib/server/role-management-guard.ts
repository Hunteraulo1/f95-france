import type { PermissionKey } from '$lib/permissions/catalog';
import { getPermissionsForRole } from '$lib/server/permissions';

const SYSTEM_ROLE_ORDER = ['user', 'translator', 'admin', 'superadmin'] as const;

export function isRolesManagementSuperadmin(locals: App.Locals): boolean {
	return locals.user?.role === 'superadmin';
}

export async function getActorPermissionSet(locals: App.Locals): Promise<Set<string>> {
	if (!locals.user) return new Set();
	const perms =
		locals.permissions && locals.permissions.length > 0
			? locals.permissions
			: await getPermissionsForRole(locals.user.role);
	return new Set(perms);
}

function systemRoleRank(slug: string): number {
	const idx = SYSTEM_ROLE_ORDER.indexOf(slug as (typeof SYSTEM_ROLE_ORDER)[number]);
	return idx === -1 ? -1 : idx;
}

export type RoleManageCheckResult = { allowed: true } | { allowed: false; message: string };

/**
 * Vérifie qu’un gestionnaire de rôles (hors superadmin) peut modifier un rôle cible :
 * pas son propre rôle, pas un rôle système de rang supérieur, pas de droits qu’il ne possède pas.
 */
export async function assertCanManageRole(
	locals: App.Locals,
	targetSlug: string,
	targetPermissionKeys?: readonly string[]
): Promise<RoleManageCheckResult> {
	if (isRolesManagementSuperadmin(locals)) return { allowed: true };
	if (!locals.user) return { allowed: false, message: 'Non connecté' };

	if (locals.user.role === targetSlug) {
		return { allowed: false, message: 'Vous ne pouvez pas modifier votre propre rôle' };
	}

	const actorRank = systemRoleRank(locals.user.role);
	const targetRank = systemRoleRank(targetSlug);
	if (actorRank !== -1 && targetRank !== -1 && targetRank > actorRank) {
		return { allowed: false, message: 'Ce rôle système a un niveau supérieur au vôtre' };
	}

	const targetPerms = targetPermissionKeys ?? (await getPermissionsForRole(targetSlug));
	const actorPerms = await getActorPermissionSet(locals);

	const extras = targetPerms.filter((k) => !actorPerms.has(k));
	if (extras.length > 0) {
		return {
			allowed: false,
			message: 'Ce rôle possède des droits que vous n’avez pas'
		};
	}

	return { allowed: true };
}

/** Ne conserve que les permissions que l’acteur possède déjà (sauf superadmin). */
export function filterPermissionsAssignableByActor(
	actorPermissions: Set<string>,
	requested: string[],
	isSuperadmin: boolean
): { keys: PermissionKey[]; rejected: string[] } {
	if (isSuperadmin) {
		return { keys: requested as PermissionKey[], rejected: [] };
	}
	const keys = requested.filter((k) => actorPermissions.has(k)) as PermissionKey[];
	const rejected = requested.filter((k) => !actorPermissions.has(k));
	return { keys, rejected };
}
