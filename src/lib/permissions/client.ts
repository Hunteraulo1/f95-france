import { derived, get } from 'svelte/store';
import { user, userPermissions } from '$lib/stores';
import type { PermissionKey } from './catalog';
import { permissionGranted } from './check';

type PermissionChecker = (key: PermissionKey | string) => boolean;

/**
 * Store de vérification des permissions.
 * - Dans les `.svelte` : `$hasPermission('games.manage')`
 * - Hors composant : `getHasPermission()('games.manage')`
 */
export const hasPermission = derived<[typeof user, typeof userPermissions], PermissionChecker>(
	[user, userPermissions],
	([u, perms]) => (key: PermissionKey | string) => permissionGranted(u?.role, perms, key)
);

/** Vérification synchrone (handlers, modules `.ts`). */
export function getHasPermission(): PermissionChecker {
	return get(hasPermission);
}
