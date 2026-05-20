import { SYSTEM_ROLE_PERMISSIONS } from './catalog';

const SYSTEM_ROLE_ORDER = ['user', 'translator', 'admin', 'superadmin'] as const;

/** Du moins au plus de droits (utilisateur → superadmin, rôles custom intercalés). */
export function sortRolesByPrivileges<T extends { slug: string; label?: string }>(
	roles: T[],
	permissionCountBySlug: Record<string, number>
): T[] {
	const systemRank = (slug: string) => {
		const index = SYSTEM_ROLE_ORDER.indexOf(slug as (typeof SYSTEM_ROLE_ORDER)[number]);
		return index === -1 ? SYSTEM_ROLE_ORDER.length : index;
	};

	return [...roles].sort((a, b) => {
		const countDiff = (permissionCountBySlug[a.slug] ?? 0) - (permissionCountBySlug[b.slug] ?? 0);
		if (countDiff !== 0) return countDiff;

		const rankDiff = systemRank(a.slug) - systemRank(b.slug);
		if (rankDiff !== 0) return rankDiff;

		return (a.label ?? a.slug).localeCompare(b.label ?? b.slug, 'fr');
	});
}

export function legacyPermissionCounts(): Record<string, number> {
	return Object.fromEntries(
		Object.entries(SYSTEM_ROLE_PERMISSIONS).map(([slug, keys]) => [slug, keys.length])
	);
}
