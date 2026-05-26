import {
	isRoleBadgeStyle,
	resolveRoleBadgeStyle,
	type RoleBadgeStyle
} from '$lib/permissions/role-badge-style';

const SUPERADMIN_ANIMATED_CLASS = 'username-superadmin animate-text';

function roleStyleClass(style: RoleBadgeStyle): string {
	if (style === 'default') return '';
	if (style === 'superadmin') return SUPERADMIN_ANIMATED_CLASS;
	return `username-role-${style}`;
}

/** Classes pour le pseudo (profil, listes utilisateurs, soumissions…). */
export function roleUsernameClass(
	roleSlug: string | null | undefined,
	badgeStyle?: string | null
): string {
	if (!roleSlug) return '';
	const style = badgeStyle
		? isRoleBadgeStyle(badgeStyle)
			? badgeStyle
			: resolveRoleBadgeStyle(roleSlug, badgeStyle)
		: resolveRoleBadgeStyle(roleSlug, null);
	return roleStyleClass(style);
}

/** Classes pour un badge de rôle (à combiner avec `badge`, `badge-outline`, etc.). */
export const roleBadgeClass = roleUsernameClass;
