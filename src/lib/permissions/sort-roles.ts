export const SYSTEM_ROLE_ORDER = ['user', 'translator', 'admin', 'superadmin'] as const;

export function systemRoleRank(slug: string): number {
	const index = SYSTEM_ROLE_ORDER.indexOf(slug as (typeof SYSTEM_ROLE_ORDER)[number]);
	return index === -1 ? -1 : index;
}

/** Du plus au moins de droits (superadmin → utilisateur, rôles custom intercalés). */
export function sortRolesByPrivileges<T extends { slug: string; label?: string }>(
	roles: T[],
	permissionCountBySlug: Record<string, number>
): T[] {
	const systemRank = (slug: string) => {
		const index = SYSTEM_ROLE_ORDER.indexOf(slug as (typeof SYSTEM_ROLE_ORDER)[number]);
		return index === -1 ? SYSTEM_ROLE_ORDER.length : index;
	};

	return [...roles].sort((a, b) => {
		const countDiff = (permissionCountBySlug[b.slug] ?? 0) - (permissionCountBySlug[a.slug] ?? 0);
		if (countDiff !== 0) return countDiff;

		const rankDiff = systemRank(b.slug) - systemRank(a.slug);
		if (rankDiff !== 0) return rankDiff;

		return (a.label ?? a.slug).localeCompare(b.label ?? b.slug, 'fr');
	});
}
