import { enforcePermissionDependencies } from '$lib/permissions/dependencies';
import { systemRoleRank } from '$lib/permissions/sort-roles';
import {
	countEffectivePermissionsForRole,
	getEffectivePermissionsByRoles,
	getEffectivePermissionsForRole,
	hasPermission
} from '$lib/server/permissions';

/** Rôles attribuables sans la permission `users.assign_admin`. */
export const ROLES_ASSIGNABLE_WITHOUT_ADMIN = ['user', 'translator'] as const;

export type UserRoleAssignmentCheckResult = { allowed: true } | { allowed: false; message: string };

function isRoleAllowedWithoutAssignAdmin(roleSlug: string): boolean {
	return (ROLES_ASSIGNABLE_WITHOUT_ADMIN as readonly string[]).includes(roleSlug);
}

async function getRolePermissionCount(roleSlug: string): Promise<number> {
	return (await getEffectivePermissionsForRole(roleSlug)).length;
}

/** Droits effectifs de l’utilisateur connecté (session courante, après dépendances). */
async function getActorPermissionCount(locals: App.Locals): Promise<number> {
	if (locals.permissions?.length) {
		return enforcePermissionDependencies(locals.permissions).length;
	}
	if (!locals.user?.role) return 0;
	return countEffectivePermissionsForRole(locals.user.role);
}

/**
 * Indique si l’acteur peut attribuer un rôle cible.
 * Compare les droits effectifs (session + `getPermissionsForRole`), pas un simple COUNT SQL.
 */
export async function isUserRoleAssignableByActor(
	locals: App.Locals,
	targetRoleSlug: string
): Promise<boolean> {
	if (!locals.user?.role) return false;

	const canAssignAdmin = hasPermission(locals, 'users.assign_admin');
	if (!canAssignAdmin && !isRoleAllowedWithoutAssignAdmin(targetRoleSlug)) {
		return false;
	}

	const actorRank = systemRoleRank(locals.user.role);
	const targetRank = systemRoleRank(targetRoleSlug);
	if (actorRank !== -1 && targetRank !== -1 && targetRank >= actorRank) {
		return false;
	}

	const [actorCount, targetCount] = await Promise.all([
		getActorPermissionCount(locals),
		getRolePermissionCount(targetRoleSlug)
	]);

	return targetCount < actorCount;
}

export async function assertCanAssignUserRole(
	locals: App.Locals,
	targetRoleSlug: string
): Promise<UserRoleAssignmentCheckResult> {
	if (!locals.user?.role) {
		return { allowed: false, message: 'Non connecté' };
	}

	if (!(await isUserRoleAssignableByActor(locals, targetRoleSlug))) {
		const canAssignAdmin = hasPermission(locals, 'users.assign_admin');
		if (!canAssignAdmin && !isRoleAllowedWithoutAssignAdmin(targetRoleSlug)) {
			return {
				allowed: false,
				message:
					'Sans la permission « Attribuer admin / superadmin », seuls les rôles Utilisateur et Traducteur peuvent être attribués'
			};
		}

		const actorRank = systemRoleRank(locals.user.role);
		const targetRank = systemRoleRank(targetRoleSlug);
		if (actorRank !== -1 && targetRank !== -1 && targetRank >= actorRank) {
			return {
				allowed: false,
				message: 'Vous ne pouvez pas attribuer un rôle système supérieur ou égal au vôtre'
			};
		}

		const [actorCount, targetCount] = await Promise.all([
			getActorPermissionCount(locals),
			getRolePermissionCount(targetRoleSlug)
		]);
		if (targetCount >= actorCount) {
			return {
				allowed: false,
				message: `Vous ne pouvez pas attribuer un rôle ayant au moins autant de droits que le vôtre (${targetCount} contre ${actorCount})`
			};
		}

		return { allowed: false, message: 'Rôle non autorisé pour votre compte' };
	}

	return { allowed: true };
}

/** Peut-on modifier le compte d’un utilisateur qui a déjà ce rôle ? */
export async function assertCanManageUserWithRole(
	locals: App.Locals,
	targetCurrentRole: string,
	targetUserId: string
): Promise<UserRoleAssignmentCheckResult> {
	if (!locals.user?.role) {
		return { allowed: false, message: 'Non connecté' };
	}

	if (locals.user.id === targetUserId) {
		return { allowed: true };
	}

	const canAssignAdmin = hasPermission(locals, 'users.assign_admin');
	if (!canAssignAdmin && !isRoleAllowedWithoutAssignAdmin(targetCurrentRole)) {
		return {
			allowed: false,
			message: 'Vous ne pouvez modifier que les comptes aux rôles Utilisateur et Traducteur'
		};
	}

	const [actorCount, targetCount] = await Promise.all([
		getActorPermissionCount(locals),
		getRolePermissionCount(targetCurrentRole)
	]);

	if (targetCount >= actorCount) {
		const actorRank = systemRoleRank(locals.user.role);
		const targetRank = systemRoleRank(targetCurrentRole);
		if (actorRank !== -1 && targetRank !== -1 && targetRank >= actorRank) {
			return {
				allowed: false,
				message:
					'Vous ne pouvez pas modifier un utilisateur dont le rôle système est supérieur ou égal au vôtre'
			};
		}
		return {
			allowed: false,
			message:
				'Vous ne pouvez pas modifier un utilisateur dont le rôle a au moins autant de droits que le vôtre'
		};
	}

	return { allowed: true };
}

export async function listRolesAssignableToUsers(
	locals: App.Locals,
	roles: { slug: string; label: string; isSystem: boolean }[]
): Promise<{ value: string; label: string; isSystem: boolean; assignable: boolean }[]> {
	if (!locals.user?.role) {
		return roles.map((r) => ({
			value: r.slug,
			label: r.label,
			isSystem: r.isSystem,
			assignable: false
		}));
	}

	const actorCount = await getActorPermissionCount(locals);
	const effectiveBySlug = await getEffectivePermissionsByRoles(roles.map((r) => r.slug));
	const countBySlug = Object.fromEntries(
		roles.map((r) => [r.slug, effectiveBySlug[r.slug]?.length ?? 0])
	);

	const canAssignAdmin = hasPermission(locals, 'users.assign_admin');
	const actorRank = systemRoleRank(locals.user.role);

	return roles.map((r) => {
		if (!canAssignAdmin && !isRoleAllowedWithoutAssignAdmin(r.slug)) {
			return { value: r.slug, label: r.label, isSystem: r.isSystem, assignable: false };
		}
		const targetRank = systemRoleRank(r.slug);
		if (actorRank !== -1 && targetRank !== -1 && targetRank >= actorRank) {
			return { value: r.slug, label: r.label, isSystem: r.isSystem, assignable: false };
		}
		const targetCount = countBySlug[r.slug] ?? 0;
		return {
			value: r.slug,
			label: r.label,
			isSystem: r.isSystem,
			assignable: targetCount < actorCount
		};
	});
}
