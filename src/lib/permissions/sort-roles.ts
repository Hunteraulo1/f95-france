import { resolveRolePriority } from './role-priority';

export const SYSTEM_ROLE_ORDER = ['user', 'translator', 'admin', 'superadmin'] as const;

export function systemRoleRank(slug: string): number {
	const index = SYSTEM_ROLE_ORDER.indexOf(slug as (typeof SYSTEM_ROLE_ORDER)[number]);
	return index === -1 ? -1 : index;
}

/** Du plus fort au plus faible (`priority`), puis libellé. */
export function sortRolesByPriority<T extends { slug: string; label?: string; priority?: number }>(
	roles: T[]
): T[] {
	return [...roles].sort((a, b) => {
		const priorityDiff =
			resolveRolePriority(b.slug, b.priority) - resolveRolePriority(a.slug, a.priority);
		if (priorityDiff !== 0) return priorityDiff;
		return (a.label ?? a.slug).localeCompare(b.label ?? b.slug, 'fr');
	});
}

/** Du plus au moins de droits (superadmin → utilisateur, rôles custom intercalés). */
export function sortRolesByPrivileges<T extends { slug: string; label?: string }>(
	roles: T[],
	permissionCountBySlug: Record<string, number>
): T[] {
	return [...roles].sort((a, b) => {
		const countDiff = (permissionCountBySlug[b.slug] ?? 0) - (permissionCountBySlug[a.slug] ?? 0);
		if (countDiff !== 0) return countDiff;

		const rankA = systemRoleRank(a.slug);
		const rankB = systemRoleRank(b.slug);
		const orderA = rankA === -1 ? SYSTEM_ROLE_ORDER.length : rankA;
		const orderB = rankB === -1 ? SYSTEM_ROLE_ORDER.length : rankB;
		const rankDiff = orderB - orderA;
		if (rankDiff !== 0) return rankDiff;

		return (a.label ?? a.slug).localeCompare(b.label ?? b.slug, 'fr');
	});
}
