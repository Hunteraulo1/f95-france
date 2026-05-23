import { user, userPermissions } from '$lib/stores';
import { derived, get } from 'svelte/store';
import { isSuperadminRole, PERMISSION_KEYS, type PermissionKey } from './catalog';
import { resolveEffectivePermissions } from './effective';

export function effectivePermissionsForCurrentUser(): string[] {
	const loggedUser = get(user);
	if (!loggedUser?.role) return [];
	if (isSuperadminRole(loggedUser.role)) return [...PERMISSION_KEYS];
	return resolveEffectivePermissions(loggedUser.role, get(userPermissions));
}

/** Store réactif des droits effectifs (à utiliser avec `$effectivePermissions` dans les .svelte). */
export const effectivePermissions = derived(
	[user, userPermissions],
	([loggedUser, permissions]) => {
		if (isSuperadminRole(loggedUser?.role)) return [...PERMISSION_KEYS];
		return loggedUser?.role ? resolveEffectivePermissions(loggedUser.role, permissions) : [];
	}
);

/**
 * Vérifie une permission hors composant Svelte (non réactif).
 * Le rôle `superadmin` a tous les droits.
 * Dans un `.svelte`, préférer `$derived($effectivePermissions.includes(key))` ou cette fonction.
 */
export function checkPermission(key: PermissionKey | string): boolean {
	const loggedUser = get(user);
	if (isSuperadminRole(loggedUser?.role)) return true;
	return effectivePermissionsForCurrentUser().includes(key);
}

export function hasPermissionKey(
	role: string | undefined,
	permissions: readonly string[],
	key: PermissionKey | string
): boolean {
	if (isSuperadminRole(role)) return true;
	if (!role) return false;
	return resolveEffectivePermissions(role, permissions).includes(key);
}
