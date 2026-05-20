import { SYSTEM_ROLE_PERMISSIONS, type PermissionKey } from './catalog';
import { legacyPermissionsForRole } from './legacy';

/** Droits effectifs = DB + repli legacy pour les rôles système (évite les listes partielles en base). */
export function resolveEffectivePermissions(
	roleSlug: string,
	loaded?: readonly string[]
): string[] {
	const legacy = [...legacyPermissionsForRole(roleSlug)];
	const fromDb = loaded ?? [];

	if (!(roleSlug in SYSTEM_ROLE_PERMISSIONS)) {
		return fromDb.length > 0 ? [...fromDb] : legacy;
	}

	return [...new Set([...fromDb, ...legacy])];
}

export function hasEffectivePermission(
	roleSlug: string,
	loaded: readonly string[] | undefined,
	key: PermissionKey | string
): boolean {
	return resolveEffectivePermissions(roleSlug, loaded).includes(key);
}
