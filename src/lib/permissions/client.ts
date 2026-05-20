import { user, userPermissions } from '$lib/stores';
import { get } from 'svelte/store';
import type { PermissionKey } from './catalog';
import { legacyPermissionsForRole } from './legacy';

export function hasClientPermission(
	permissions: string[] | undefined,
	key: PermissionKey | string
): boolean {
	if (!permissions?.length) return false;
	return permissions.includes(key);
}

/** Vérifie une permission côté client (store layout ou repli legacy). */
export function checkPermission(key: PermissionKey | string): boolean {
	const perms = get(userPermissions);
	if (perms.length > 0) {
		return hasClientPermission(perms, key);
	}
	const loggedUser = get(user);
	if (!loggedUser?.role) return false;
	return legacyPermissionsForRole(loggedUser.role).includes(key as PermissionKey);
}
