import {
	isSuperadminRole,
	PERMISSION_CATALOG,
	PERMISSION_KEYS,
	SYSTEM_ROLE_EDIT_MODES,
	SYSTEM_ROLE_PERMISSIONS,
	type PermissionKey
} from '$lib/permissions/catalog';
import { permissionGranted } from '$lib/permissions/check';
import { enforcePermissionDependencies } from '$lib/permissions/dependencies';
import { SYSTEM_ROLE_BADGE_STYLES } from '$lib/permissions/role-badge-style';
import { sortRolesByPrivileges } from '$lib/permissions/sort-roles';
import { selectAllAppRoles } from '$lib/server/app-role-query';
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
	if (isSuperadminRole(roleSlug)) {
		return [...PERMISSION_KEYS];
	}

	const cached = cacheGet(roleSlug);
	if (cached) return cached;

	const rows = await db
		.select({ permissionKey: table.appRolePermission.permissionKey })
		.from(table.appRolePermission)
		.where(eq(table.appRolePermission.roleSlug, roleSlug));

	const permissions = rows.map((r) => r.permissionKey);
	cacheSet(roleSlug, permissions);
	return permissions;
}

/** Vérifie une permission pour la requête courante (bypass superadmin). */
export function hasPermission(locals: App.Locals, key: PermissionKey | string): boolean {
	return permissionGranted(locals.user?.role, locals.permissions, key);
}

/** Vérifie une permission pour un autre utilisateur (hors `locals`). */
export async function hasPermissionForUser(
	user: { role: string } | null | undefined,
	key: PermissionKey | string
): Promise<boolean> {
	if (!user?.role) return false;
	const permissions = await getPermissionsForRole(user.role);
	return permissionGranted(user.role, permissions, key);
}

/** Refuse la requête si la permission est absente (403). */
export function assertPermission(
	locals: App.Locals,
	key: PermissionKey | string,
	message = 'Accès non autorisé'
): void {
	if (!hasPermission(locals, key)) {
		error(403, message);
	}
}

export function assertAnyPermission(
	locals: App.Locals,
	keys: PermissionKey[],
	message = 'Accès non autorisé'
): void {
	if (keys.some((key) => hasPermission(locals, key))) return;
	error(403, message);
}

export async function attachPermissionsToLocals(locals: App.Locals): Promise<void> {
	if (!locals.user) {
		locals.permissions = [];
		return;
	}
	locals.permissions = await getEffectivePermissionsForRole(locals.user.role);
}

export async function countPermissionsByRoles(
	roleSlugs: string[]
): Promise<Record<string, number>> {
	const counts: Record<string, number> = {};
	for (const slug of roleSlugs) counts[slug] = 0;

	if (roleSlugs.length === 0) return counts;

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

	return counts;
}

/**
 * Permissions réellement actives pour un rôle (droits en base + règles de dépendance).
 * C’est la « vraie vision » utilisée pour les comparaisons et l’affichage des totaux.
 */
export async function getEffectivePermissionsForRole(roleSlug: string): Promise<string[]> {
	const permissions = await getPermissionsForRole(roleSlug);
	return enforcePermissionDependencies(permissions);
}

export async function countEffectivePermissionsForRole(roleSlug: string): Promise<number> {
	return (await getEffectivePermissionsForRole(roleSlug)).length;
}

export async function countEffectivePermissionsByRoles(
	roleSlugs: string[]
): Promise<Record<string, number>> {
	const counts: Record<string, number> = {};
	if (roleSlugs.length === 0) return counts;

	await Promise.all(
		roleSlugs.map(async (slug) => {
			counts[slug] = (await getEffectivePermissionsForRole(slug)).length;
		})
	);
	return counts;
}

/** @deprecated Préférer `countEffectivePermissionsForRole` / `getEffectivePermissionsForRole`. */
export function effectivePermissionCount(
	roleSlug: string,
	countsByRole: Record<string, number>
): number {
	if (isSuperadminRole(roleSlug)) {
		return PERMISSION_CATALOG.length;
	}
	return countsByRole[roleSlug] ?? 0;
}

export async function listAppRoles() {
	const roles = await selectAllAppRoles();
	const slugs = roles.map((r) => r.slug);
	const permissionCounts = await countEffectivePermissionsByRoles(slugs);
	return sortRolesByPrivileges(roles, permissionCounts);
}

export async function listRolePermissions(roleSlug: string): Promise<string[]> {
	return getPermissionsForRole(roleSlug);
}

/** Permissions enregistrées en base pour un rôle (sans expansion superadmin). */
export async function listRolePermissionsStored(roleSlug: string): Promise<string[]> {
	const rows = await db
		.select({ permissionKey: table.appRolePermission.permissionKey })
		.from(table.appRolePermission)
		.where(eq(table.appRolePermission.roleSlug, roleSlug));
	return rows.map((row) => row.permissionKey);
}

export async function roleExists(slug: string): Promise<boolean> {
	const [row] = await db
		.select({ slug: table.appRole.slug })
		.from(table.appRole)
		.where(eq(table.appRole.slug, slug))
		.limit(1);
	return Boolean(row);
}

/** Insère les permissions du catalogue absentes en base (ex. après ajout d’une nouvelle clé). */
export async function syncPermissionsCatalog(): Promise<void> {
	const existing = await db.select({ key: table.appPermission.key }).from(table.appPermission);
	const existingKeys = new Set(existing.map((row) => row.key));
	const missing = PERMISSION_CATALOG.filter((p) => !existingKeys.has(p.key));
	if (missing.length === 0) return;

	await db.insert(table.appPermission).values(
		missing.map((p) => ({
			key: p.key,
			label: p.label,
			description: p.description,
			group: p.group
		}))
	);
}

export async function ensurePermissionsCatalogSeeded(): Promise<void> {
	const existing = await db
		.select({ key: table.appPermission.key })
		.from(table.appPermission)
		.limit(1);
	if (existing.length > 0) {
		await syncPermissionsCatalog();
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
			editMode: SYSTEM_ROLE_EDIT_MODES[slug as keyof typeof SYSTEM_ROLE_EDIT_MODES],
			badgeStyle: SYSTEM_ROLE_BADGE_STYLES[slug] ?? 'default',
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
	await syncPermissionsCatalog();

	const validKeys = new Set(PERMISSION_CATALOG.map((p) => p.key));
	const filtered = enforcePermissionDependencies(
		permissionKeys.filter((k) => validKeys.has(k as PermissionKey))
	);

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
