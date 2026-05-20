import {
	PERMISSION_CATALOG,
	SYSTEM_ROLE_PERMISSIONS,
	type PermissionKey
} from '$lib/permissions/catalog';
import { legacyEditModeForRoleSlug } from '$lib/permissions/edit-mode';
import { resolveEffectivePermissions } from '$lib/permissions/effective';
import { legacyPermissionsForRole } from '$lib/permissions/legacy';
import { legacyPermissionCounts, sortRolesByPrivileges } from '$lib/permissions/sort-roles';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { invalidateRoleEditModeCache } from '$lib/server/role-edit-mode';
import { error } from '@sveltejs/kit';
import { eq, inArray, sql } from 'drizzle-orm';

const rolePermissionsCache = new Map<string, { permissions: string[]; expiresAt: number }>();
const CACHE_TTL_MS = 30_000;

function cacheGet(roleSlug: string): string[] | null {
	const entry = rolePermissionsCache.get(roleSlug);
	if (!entry) return null;
	if (Date.now() > entry.expiresAt) {
		rolePermissionsCache.delete(roleSlug);
		return null;
	}
	return entry.permissions;
}

function cacheSet(roleSlug: string, permissions: string[]) {
	rolePermissionsCache.set(roleSlug, {
		permissions,
		expiresAt: Date.now() + CACHE_TTL_MS
	});
}

export function invalidateRolePermissionsCache(roleSlug?: string) {
	if (roleSlug) {
		rolePermissionsCache.delete(roleSlug);
		invalidateRoleEditModeCache(roleSlug);
		return;
	}
	rolePermissionsCache.clear();
	invalidateRoleEditModeCache();
}

export async function getPermissionsForRole(roleSlug: string): Promise<string[]> {
	const cached = cacheGet(roleSlug);
	if (cached) return cached;

	try {
		const rows = await db
			.select({ permissionKey: table.appRolePermission.permissionKey })
			.from(table.appRolePermission)
			.where(eq(table.appRolePermission.roleSlug, roleSlug));

		if (rows.length > 0) {
			const permissions = resolveEffectivePermissions(
				roleSlug,
				rows.map((r) => r.permissionKey)
			);
			cacheSet(roleSlug, permissions);
			return permissions;
		}
	} catch (err) {
		console.warn('Permissions DB indisponible, repli legacy:', err);
	}

	const legacy = legacyPermissionsForRole(roleSlug);
	cacheSet(roleSlug, legacy);
	return legacy;
}

export function hasPermission(
	permissions: string[] | undefined,
	key: PermissionKey | string
): boolean {
	if (!permissions?.length) return false;
	return permissions.includes(key);
}

export async function userHasPermission(
	user: { role: string } | null | undefined,
	key: PermissionKey | string
): Promise<boolean> {
	if (!user?.role) return false;
	const permissions = await getPermissionsForRole(user.role);
	return hasPermission(permissions, key);
}

export function requireUserPermission(
	locals: App.Locals,
	key: PermissionKey | string,
	message = 'Accès non autorisé'
): void {
	if (!locals.user) {
		error(401, message);
	}
	// permissions chargées de façon synchrone via locals.permissions quand disponible
	if (locals.permissions && hasPermission(locals.permissions, key)) {
		return;
	}
	error(403, message);
}

export async function attachPermissionsToLocals(locals: App.Locals): Promise<void> {
	if (!locals.user) {
		locals.permissions = [];
		return;
	}
	locals.permissions = await getPermissionsForRole(locals.user.role);
}

export async function countPermissionsByRoles(
	roleSlugs: string[]
): Promise<Record<string, number>> {
	const counts: Record<string, number> = {};
	for (const slug of roleSlugs) counts[slug] = 0;

	if (roleSlugs.length === 0) return counts;

	try {
		const rows = await db
			.select({
				roleSlug: table.appRolePermission.roleSlug,
				count: sql<number>`count(*)::int`.as('count')
			})
			.from(table.appRolePermission)
			.where(inArray(table.appRolePermission.roleSlug, roleSlugs))
			.groupBy(table.appRolePermission.roleSlug);

		for (const row of rows) {
			counts[row.roleSlug] = Number(row.count) || 0;
		}
	} catch {
		const legacy = legacyPermissionCounts();
		for (const slug of roleSlugs) {
			counts[slug] = legacy[slug] ?? legacy.user;
		}
	}

	return counts;
}

export async function listAppRoles() {
	try {
		const roles = await db.select().from(table.appRole);
		const slugs = roles.map((r) => r.slug);
		const permissionCounts = await countPermissionsByRoles(slugs);
		return sortRolesByPrivileges(roles, permissionCounts);
	} catch {
		const roles = Object.entries(SYSTEM_ROLE_PERMISSIONS).map(([slug]) => ({
			slug,
			label: slug,
			description: null,
			editMode: legacyEditModeForRoleSlug(slug),
			isSystem: true,
			createdAt: new Date(),
			updatedAt: new Date()
		}));
		return sortRolesByPrivileges(roles, legacyPermissionCounts());
	}
}

export async function listRolePermissions(roleSlug: string): Promise<string[]> {
	return getPermissionsForRole(roleSlug);
}

export async function roleExists(slug: string): Promise<boolean> {
	try {
		const [row] = await db
			.select({ slug: table.appRole.slug })
			.from(table.appRole)
			.where(eq(table.appRole.slug, slug))
			.limit(1);
		return Boolean(row);
	} catch {
		return slug in SYSTEM_ROLE_PERMISSIONS;
	}
}

export async function ensurePermissionsCatalogSeeded(): Promise<void> {
	try {
		const existing = await db
			.select({ key: table.appPermission.key })
			.from(table.appPermission)
			.limit(1);
		if (existing.length > 0) return;
	} catch {
		return;
	}

	await db.insert(table.appPermission).values(
		PERMISSION_CATALOG.map((p) => ({
			key: p.key,
			label: p.label,
			description: p.description,
			group: p.group
		}))
	);

	const systemRoles = Object.keys(SYSTEM_ROLE_PERMISSIONS);
	await db.insert(table.appRole).values(
		systemRoles.map((slug) => ({
			slug,
			label: slug,
			editMode: legacyEditModeForRoleSlug(slug),
			isSystem: true
		}))
	);

	const links: { roleSlug: string; permissionKey: string }[] = [];
	for (const [slug, keys] of Object.entries(SYSTEM_ROLE_PERMISSIONS)) {
		for (const key of keys) {
			links.push({ roleSlug: slug, permissionKey: key });
		}
	}
	if (links.length > 0) {
		await db.insert(table.appRolePermission).values(links);
	}
}

export async function setRolePermissions(
	roleSlug: string,
	permissionKeys: string[]
): Promise<void> {
	const validKeys = new Set(PERMISSION_CATALOG.map((p) => p.key));
	const filtered = [...new Set(permissionKeys.filter((k) => validKeys.has(k as PermissionKey)))];

	await db.delete(table.appRolePermission).where(eq(table.appRolePermission.roleSlug, roleSlug));

	if (filtered.length > 0) {
		await db
			.insert(table.appRolePermission)
			.values(filtered.map((permissionKey) => ({ roleSlug, permissionKey })));
	}

	invalidateRolePermissionsCache(roleSlug);
}

export async function countUsersWithRole(roleSlug: string): Promise<number> {
	const counts = await countUsersWithRoles([roleSlug]);
	return counts[roleSlug] ?? 0;
}

export async function countUsersWithRoles(roleSlugs: string[]): Promise<Record<string, number>> {
	if (roleSlugs.length === 0) return {};
	const rows = await db
		.select({ role: table.user.role })
		.from(table.user)
		.where(inArray(table.user.role, roleSlugs));

	const counts: Record<string, number> = {};
	for (const slug of roleSlugs) counts[slug] = 0;
	for (const row of rows) {
		counts[row.role] = (counts[row.role] ?? 0) + 1;
	}
	return counts;
}
