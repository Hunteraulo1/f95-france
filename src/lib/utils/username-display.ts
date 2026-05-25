import { isSuperadminRole } from '$lib/permissions/catalog';

const SUPERADMIN_ANIMATED_CLASS = 'username-superadmin animate-text';

/** Classes pour le pseudo animé des comptes superadmin. */
export function superadminUsernameClass(role: string | null | undefined): string {
	return isSuperadminRole(role) ? SUPERADMIN_ANIMATED_CLASS : '';
}

/** Classes d’animation pour un badge de rôle superadmin (à combiner avec `badge`, etc.). */
export function superadminBadgeClass(role: string | null | undefined): string {
	return isSuperadminRole(role) ? SUPERADMIN_ANIMATED_CLASS : '';
}
