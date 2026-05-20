import { user, userPermissions } from '$lib/stores';
import { get } from 'svelte/store';
import type { PermissionKey } from './catalog';
import { resolveEffectivePermissions } from './effective';

export function effectivePermissionsForCurrentUser(): string[] {
	const loggedUser = get(user);
	if (!loggedUser?.role) return [];
	return resolveEffectivePermissions(loggedUser.role, get(userPermissions));
}

/** Vérifie une permission côté client (store layout + repli legacy pour rôles système). */
export function checkPermission(key: PermissionKey | string): boolean {
	return effectivePermissionsForCurrentUser().includes(key);
}
