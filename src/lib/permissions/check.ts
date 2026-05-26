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
