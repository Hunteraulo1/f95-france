import {
	isRoleBadgeStyle,
	resolveRoleBadgeStyle,
	SYSTEM_ROLE_BADGE_STYLES,
	type RoleBadgeStyle
} from '$lib/permissions/role-badge-style';
import { selectAllAppRoles } from '$lib/server/app-role-query';

let cache: { map: Record<string, RoleBadgeStyle>; expiresAt: number } | null = null;
const CACHE_TTL_MS = 30_000;

export function invalidateRoleBadgeStylesCache(): void {
	cache = null;
}

export async function listRoleBadgeStylesMap(): Promise<Record<string, RoleBadgeStyle>> {
	if (cache && Date.now() <= cache.expiresAt) {
		return cache.map;
	}

	try {
		const rows = await selectAllAppRoles();

		const map: Record<string, RoleBadgeStyle> = { ...SYSTEM_ROLE_BADGE_STYLES };
		for (const row of rows) {
			map[row.slug] = resolveRoleBadgeStyle(row.slug, row.badgeStyle);
		}

		cache = { map, expiresAt: Date.now() + CACHE_TTL_MS };
		return map;
	} catch {
		return { ...SYSTEM_ROLE_BADGE_STYLES };
	}
}

export async function getRoleBadgeStyle(roleSlug: string): Promise<RoleBadgeStyle> {
	const map = await listRoleBadgeStylesMap();
	return map[roleSlug] ?? resolveRoleBadgeStyle(roleSlug, null);
}

export function parseRoleBadgeStyleInput(value: string): RoleBadgeStyle | null {
	const trimmed = value.trim();
	return isRoleBadgeStyle(trimmed) ? trimmed : null;
}
