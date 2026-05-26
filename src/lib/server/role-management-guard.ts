import { isSuperadminRole, type PermissionKey } from '$lib/permissions/catalog';
import { systemRoleRank } from '$lib/permissions/sort-roles';
import { getPermissionsForRole, hasPermission } from '$lib/server/permissions';

/** Peut attribuer toutes les permissions à un rôle (dont droits admin). */
export function canAssignAllRolePermissions(locals: App.Locals): boolean {
	return hasPermission(locals, 'users.assign_admin');
}

export async function getActorPermissionSet(locals: App.Locals): Promise<Set<string>> {
	if (!locals.user) return new Set();
	const perms =
		locals.permissions && locals.permissions.length > 0
			? locals.permissions
			: await getPermissionsForRole(locals.user.role);
	return new Set(perms);
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
	if (isSuperadminRole(targetSlug)) {
		return {
			allowed: false,
			message:
				'Le rôle Super administrateur possède tous les droits et ne peut pas être modifié depuis cette page'
		};
	}
	if (canAssignAllRolePermissions(locals)) return { allowed: true };
	if (!locals.user) return { allowed: false, message: 'Non connecté' };

	if (locals.user.role === targetSlug) {
		return { allowed: false, message: 'Vous ne pouvez pas modifier votre propre rôle' };
	}

	const actorRank = systemRoleRank(locals.user.role);
	const targetRank = systemRoleRank(targetSlug);
	if (actorRank !== -1 && targetRank !== -1 && targetRank >= actorRank) {
		return {
			allowed: false,
			message: 'Ce rôle système a un niveau supérieur ou égal au vôtre'
		};
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
	canAssignAll: boolean
): { keys: PermissionKey[]; rejected: string[] } {
	if (canAssignAll) {
		return { keys: requested as PermissionKey[], rejected: [] };
	}
	const keys = requested.filter((k) => actorPermissions.has(k)) as PermissionKey[];
	const rejected = requested.filter((k) => !actorPermissions.has(k));
	return { keys, rejected };
}
