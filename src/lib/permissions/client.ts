import { user, userPermissions } from '$lib/stores';
import { derived } from 'svelte/store';
import type { PermissionKey } from './catalog';
import { permissionGranted } from './check';

type PermissionChecker = (key: PermissionKey | string) => boolean;

/** Store de vérification des permissions — dans les `.svelte` : `$hasPermission('games.manage')`. */
export const hasPermission = derived<[typeof user, typeof userPermissions], PermissionChecker>(
	[user, userPermissions],
	([u, perms]) =>
		(key: PermissionKey | string) =>
			permissionGranted(u?.role, perms, key)
);
