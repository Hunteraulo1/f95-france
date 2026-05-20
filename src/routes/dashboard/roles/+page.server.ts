import {
  PERMISSION_CATALOG,
  SYSTEM_ROLE_LABELS,
  type PermissionKey
} from '$lib/permissions/catalog';
import { permissionCatalogGrouped } from '$lib/permissions/legacy';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import {
  countPermissionsByRoles,
  countUsersWithRoles,
  invalidateRolePermissionsCache,
  listAppRoles,
  listRolePermissions,
  roleExists,
  setRolePermissions
} from '$lib/server/permissions';
import { assertPermission } from '$lib/server/permissions-guard';
import { fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

function slugifyRole(input: string): string {
	return input
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 64);
}

export const load: PageServerLoad = async ({ locals, url }) => {
	await assertPermission(locals, 'roles.manage');

	const roles = await listAppRoles();
	const roleSlugs = roles.map((r) => r.slug);
	const [userCounts, permissionCounts] = await Promise.all([
		countUsersWithRoles(roleSlugs),
		countPermissionsByRoles(roleSlugs)
	]);
	const orderedSlugs = roleSlugs;

	const selectedSlug = url.searchParams.get('role') ?? orderedSlugs[0] ?? 'user';
	const selectedPermissions = selectedSlug ? await listRolePermissions(selectedSlug) : [];

	const permissionGroups = [...permissionCatalogGrouped().entries()].map(([group, items]) => ({
		group,
		items
	}));

	return {
		roles: roles.map((r) => ({
			...r,
			label: SYSTEM_ROLE_LABELS[r.slug] ?? r.label,
			userCount: userCounts[r.slug] ?? 0,
			permissionCount: permissionCounts[r.slug] ?? 0
		})),
		selectedSlug,
		selectedPermissions,
		permissionGroups,
		allPermissionKeys: PERMISSION_CATALOG.map((p) => p.key)
	};
};

export const actions: Actions = {
	createRole: async ({ request, locals }) => {
		await assertPermission(locals, 'roles.manage');

		const formData = await request.formData();
		const label = (formData.get('label') as string)?.trim();
		const description = (formData.get('description') as string)?.trim() || null;
		const slugRaw = (formData.get('slug') as string)?.trim();
		const slug = slugifyRole(slugRaw || label || '');

		if (!label || !slug) {
			return fail(400, { message: 'Libellé et identifiant requis' });
		}

		if (['user', 'translator', 'admin', 'superadmin'].includes(slug)) {
			return fail(400, { message: 'Cet identifiant est réservé aux rôles système' });
		}

		if (await roleExists(slug)) {
			return fail(409, { message: 'Un rôle avec cet identifiant existe déjà' });
		}

		try {
			await db.insert(table.appRole).values({
				slug,
				label,
				description,
				isSystem: false
			});
			await setRolePermissions(slug, ['dashboard.view', 'profile.view', 'settings.view', 'api_keys.own']);
			return { success: true, message: 'Rôle créé', selectedSlug: slug };
		} catch (error) {
			console.error('createRole:', error);
			return fail(500, { message: 'Impossible de créer le rôle' });
		}
	},

	updateRole: async ({ request, locals }) => {
		await assertPermission(locals, 'roles.manage');

		const formData = await request.formData();
		const slug = (formData.get('slug') as string)?.trim();
		const label = (formData.get('label') as string)?.trim();
		const description = (formData.get('description') as string)?.trim() || null;

		if (!slug || !label) {
			return fail(400, { message: 'Champs requis manquants' });
		}

		const [role] = await db.select().from(table.appRole).where(eq(table.appRole.slug, slug)).limit(1);
		if (!role) {
			return fail(404, { message: 'Rôle introuvable' });
		}

		try {
			await db
				.update(table.appRole)
				.set({
					label: role.isSystem ? (SYSTEM_ROLE_LABELS[slug] ?? label) : label,
					description,
					updatedAt: new Date()
				})
				.where(eq(table.appRole.slug, slug));

			return { success: true, message: 'Rôle mis à jour', selectedSlug: slug };
		} catch (error) {
			console.error('updateRole:', error);
			return fail(500, { message: 'Impossible de mettre à jour le rôle' });
		}
	},

	updatePermissions: async ({ request, locals }) => {
		await assertPermission(locals, 'roles.manage');

		const formData = await request.formData();
		const slug = (formData.get('slug') as string)?.trim();
		if (!slug) {
			return fail(400, { message: 'Rôle requis' });
		}

		if (!(await roleExists(slug))) {
			return fail(404, { message: 'Rôle introuvable' });
		}

		const keys = formData
			.getAll('permissions')
			.map((v) => String(v))
			.filter((k): k is PermissionKey =>
				PERMISSION_CATALOG.some((p) => p.key === k)
			);

		try {
			await setRolePermissions(slug, keys);
			return { success: true, message: 'Permissions enregistrées', selectedSlug: slug };
		} catch (error) {
			console.error('updatePermissions:', error);
			return fail(500, { message: 'Impossible d’enregistrer les permissions' });
		}
	},

	deleteRole: async ({ request, locals }) => {
		await assertPermission(locals, 'roles.manage');

		const formData = await request.formData();
		const slug = (formData.get('slug') as string)?.trim();
		if (!slug) {
			return fail(400, { message: 'Rôle requis' });
		}

		const [role] = await db.select().from(table.appRole).where(eq(table.appRole.slug, slug)).limit(1);
		if (!role) {
			return fail(404, { message: 'Rôle introuvable' });
		}
		if (role.isSystem) {
			return fail(403, { message: 'Les rôles système ne peuvent pas être supprimés' });
		}

		const counts = await countUsersWithRoles([slug]);
		if ((counts[slug] ?? 0) > 0) {
			return fail(409, {
				message: 'Ce rôle est encore assigné à des utilisateurs'
			});
		}

		try {
			await db.delete(table.appRole).where(eq(table.appRole.slug, slug));
			invalidateRolePermissionsCache(slug);
			return { success: true, message: 'Rôle supprimé' };
		} catch (error) {
			console.error('deleteRole:', error);
			return fail(500, { message: 'Impossible de supprimer le rôle' });
		}
	}
};
