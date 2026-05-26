import { isSuperadminRole, type PermissionKey } from './catalog';

/** Vérifie si un rôle possède une permission (bypass superadmin). */
export function permissionGranted(
	roleSlug: string | null | undefined,
	permissions: readonly string[] | undefined,
	key: PermissionKey | string
): boolean {
	if (isSuperadminRole(roleSlug)) return true;
	return permissions?.includes(key) ?? false;
}

/** Au moins une des permissions listées (bypass superadmin). */
export function anyPermissionGranted(
	roleSlug: string | null | undefined,
	permissions: readonly string[] | undefined,
	keys: readonly (PermissionKey | string)[]
): boolean {
	if (isSuperadminRole(roleSlug)) return true;
	if (!permissions?.length) return false;
	return keys.some((key) => permissions.includes(key));
}
