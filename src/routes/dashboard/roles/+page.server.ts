import {
	isSuperadminRole,
	PERMISSION_CATALOG,
	permissionCatalogGrouped,
	SYSTEM_ROLE_LABELS,
	type PermissionKey
} from '$lib/permissions/catalog';
import { enforcePermissionDependencies } from '$lib/permissions/dependencies';
import {
	GAMES_MANAGE_PERMISSION,
	isRoleEditMode,
	resolveEffectiveRoleEditMode,
	ROLE_EDIT_MODE_OPTIONS
} from '$lib/permissions/edit-mode';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import {
	assertPermission,
	countPermissionsByRoles,
	countUsersWithRoles,
	invalidateRolePermissionsCache,
	listAppRoles,
	listRolePermissions,
	listRolePermissionsStored,
	roleExists,
	setRolePermissions
} from '$lib/server/permissions';
import {
	assertCanManageRole,
	filterPermissionsAssignableByActor,
	getActorPermissionSet,
	isRolesManagementSuperadmin
} from '$lib/server/role-management-guard';
import { fail, isRedirect, redirect } from '@sveltejs/kit';
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

const ROLE_NOTICE_MESSAGES: Record<string, string> = {
	created: 'Rôle créé',
	updated: 'Rôle mis à jour',
	permissions: 'Permissions enregistrées',
	deleted: 'Rôle supprimé'
};

function rolePageUrl(slug: string, notice?: keyof typeof ROLE_NOTICE_MESSAGES): string {
	const params = new URLSearchParams({ role: slug });
	if (notice) params.set('notice', notice);
	return `/dashboard/roles?${params}`;
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
	const defaultSlug = orderedSlugs[0] ?? 'user';
	const roleParam = url.searchParams.get('role');

	if (!roleParam) {
		redirect(303, rolePageUrl(defaultSlug));
	}

	const selectedSlug = roleSlugs.includes(roleParam) ? roleParam : defaultSlug;
	if (selectedSlug !== roleParam) {
		redirect(303, rolePageUrl(selectedSlug));
	}
	const isSelectedRoleSuperadmin = isSuperadminRole(selectedSlug);
	const selectedPermissionsEffective = isSelectedRoleSuperadmin
		? PERMISSION_CATALOG.map((p) => p.key)
		: selectedSlug
			? await listRolePermissions(selectedSlug)
			: [];
	const selectedPermissions = isSelectedRoleSuperadmin
		? [...selectedPermissionsEffective]
		: selectedSlug
			? await listRolePermissionsStored(selectedSlug)
			: [];

	const isSuperadmin = isRolesManagementSuperadmin(locals);
	const actorPermissions = await getActorPermissionSet(locals);

	const rolesWithAccess = await Promise.all(
		roles.map(async (r) => {
			const targetPerms = await listRolePermissions(r.slug);
			const access = isSuperadmin
				? ({ allowed: true } as const)
				: await assertCanManageRole(locals, r.slug, targetPerms);
			const hasGamesManage = targetPerms.includes(GAMES_MANAGE_PERMISSION);
			const storedEditMode = r.editMode && isRoleEditMode(r.editMode) ? r.editMode : null;
			return {
				...r,
				label: SYSTEM_ROLE_LABELS[r.slug] ?? r.label,
				hasGamesManage,
				storedEditMode,
				editMode: resolveEffectiveRoleEditMode(storedEditMode, hasGamesManage),
				userCount: userCounts[r.slug] ?? 0,
				permissionCount: isSuperadminRole(r.slug)
					? PERMISSION_CATALOG.length
					: (permissionCounts[r.slug] ?? 0),
				canManage: access.allowed,
				manageBlockedReason: access.allowed ? null : access.message
			};
		})
	);

	const permissionGroups = [...permissionCatalogGrouped().entries()]
		.map(([group, items]) => ({
			group,
			items:
				isSelectedRoleSuperadmin || isSuperadmin
					? items
					: items.filter((p) => actorPermissions.has(p.key))
		}))
		.filter((g) => g.items.length > 0);

	const selectedRoleMeta = rolesWithAccess.find((r) => r.slug === selectedSlug);

	const selectedPermissionDetails = PERMISSION_CATALOG.filter((p) =>
		selectedPermissionsEffective.includes(p.key)
	);

	const noticeKey = url.searchParams.get('notice');
	const noticeMessage =
		noticeKey && noticeKey in ROLE_NOTICE_MESSAGES
			? ROLE_NOTICE_MESSAGES[noticeKey as keyof typeof ROLE_NOTICE_MESSAGES]
			: null;

	return {
		isSuperadmin,
		isSelectedRoleSuperadmin,
		roles: rolesWithAccess,
		noticeMessage,
		selectedSlug,
		selectedPermissions,
		selectedPermissionDetails,
		selectedCanManage: selectedRoleMeta?.canManage ?? false,
		selectedManageBlockedReason: selectedRoleMeta?.manageBlockedReason ?? null,
		permissionGroups,
		allPermissionKeys: PERMISSION_CATALOG.map((p) => p.key),
		editModeOptions: ROLE_EDIT_MODE_OPTIONS
	};
};

async function rejectUnlessCanManageRole(
	locals: App.Locals,
	targetSlug: string
): Promise<{ ok: true } | { ok: false; message: string }> {
	const check = await assertCanManageRole(locals, targetSlug);
	if (!check.allowed) return { ok: false, message: check.message };
	return { ok: true };
}

export const actions: Actions = {
	createRole: async ({ request, locals }) => {
		await assertPermission(locals, 'roles.manage');

		const formData = await request.formData();
		const label = (formData.get('label') as string)?.trim();
		const description = (formData.get('description') as string)?.trim() || null;
		const editModeRaw = String(formData.get('editMode') ?? '').trim();
		if (!isRoleEditMode(editModeRaw)) {
			return fail(400, { message: 'Mode d’enregistrement invalide' });
		}
		const editMode = editModeRaw;
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

		const isSuperadmin = isRolesManagementSuperadmin(locals);
		const actorPermissions = await getActorPermissionSet(locals);
		const initialKeys = [
			'dashboard.view',
			'profile.view',
			'settings.view',
			'api_keys.own'
		] as PermissionKey[];
		const { keys: assignableInitial, rejected } = filterPermissionsAssignableByActor(
			actorPermissions,
			initialKeys,
			isSuperadmin
		);
		if (!isSuperadmin && rejected.length > 0) {
			return fail(403, {
				message: 'Impossible de créer un rôle : permissions de base indisponibles pour votre compte'
			});
		}

		try {
			await db.insert(table.appRole).values({
				slug,
				label,
				description,
				editMode,
				isSystem: false
			});
			await setRolePermissions(slug, assignableInitial);
			redirect(303, rolePageUrl(slug, 'created'));
		} catch (error) {
			if (isRedirect(error)) throw error;
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
		const editModeRaw = String(formData.get('editMode') ?? '').trim();
		const editMode = isRoleEditMode(editModeRaw) ? editModeRaw : null;

		if (!slug || !label) {
			return fail(400, { message: 'Champs requis manquants' });
		}

		const [role] = await db
			.select()
			.from(table.appRole)
			.where(eq(table.appRole.slug, slug))
			.limit(1);
		if (!role) {
			return fail(404, { message: 'Rôle introuvable' });
		}

		const guard = await rejectUnlessCanManageRole(locals, slug);
		if (!guard.ok) return fail(403, { message: guard.message });

		const rolePermissions = await listRolePermissions(slug);
		const hasGamesManage = rolePermissions.includes(GAMES_MANAGE_PERMISSION);
		if (hasGamesManage && !editMode) {
			return fail(400, { message: 'Mode d’enregistrement invalide' });
		}

		try {
			await db
				.update(table.appRole)
				.set({
					label: role.isSystem ? (SYSTEM_ROLE_LABELS[slug] ?? label) : label,
					description: role.isSystem ? role.description : description,
					...(hasGamesManage && editMode ? { editMode } : {}),
					updatedAt: new Date()
				})
				.where(eq(table.appRole.slug, slug));
			invalidateRolePermissionsCache(slug);

			redirect(303, rolePageUrl(slug, 'updated'));
		} catch (error) {
			if (isRedirect(error)) throw error;
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

		const guard = await rejectUnlessCanManageRole(locals, slug);
		if (!guard.ok) return fail(403, { message: guard.message });

		const requested = formData
			.getAll('permissions')
			.map((v) => String(v))
			.filter((k): k is PermissionKey => PERMISSION_CATALOG.some((p) => p.key === k));

		const isSuperadmin = isRolesManagementSuperadmin(locals);
		const actorPermissions = await getActorPermissionSet(locals);
		const { keys, rejected } = filterPermissionsAssignableByActor(
			actorPermissions,
			requested,
			isSuperadmin
		);

		if (!isSuperadmin && rejected.length > 0) {
			return fail(403, {
				message: 'Vous ne pouvez pas attribuer des droits que vous ne possédez pas'
			});
		}

		const storedKeys = await listRolePermissionsStored(slug);
		const preservedKeys = isSuperadmin
			? []
			: storedKeys.filter((key) => !actorPermissions.has(key));
		const keysToSave = enforcePermissionDependencies([...new Set([...preservedKeys, ...keys])]);

		const afterCheck = await assertCanManageRole(locals, slug, keysToSave);
		if (!afterCheck.allowed) {
			return fail(403, { message: afterCheck.message });
		}

		try {
			await setRolePermissions(slug, keysToSave);
			redirect(303, rolePageUrl(slug, 'permissions'));
		} catch (error) {
			if (isRedirect(error)) throw error;
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

		const [role] = await db
			.select()
			.from(table.appRole)
			.where(eq(table.appRole.slug, slug))
			.limit(1);
		if (!role) {
			return fail(404, { message: 'Rôle introuvable' });
		}
		if (role.isSystem) {
			return fail(403, { message: 'Les rôles système ne peuvent pas être supprimés' });
		}

		const guard = await rejectUnlessCanManageRole(locals, slug);
		if (!guard.ok) return fail(403, { message: guard.message });

		const counts = await countUsersWithRoles([slug]);
		if ((counts[slug] ?? 0) > 0) {
			return fail(409, {
				message: 'Ce rôle est encore assigné à des utilisateurs'
			});
		}

		try {
			await db.delete(table.appRole).where(eq(table.appRole.slug, slug));
			invalidateRolePermissionsCache(slug);
			const roles = await listAppRoles();
			const nextSlug = roles[0]?.slug ?? 'user';
			redirect(303, rolePageUrl(nextSlug, 'deleted'));
		} catch (error) {
			if (isRedirect(error)) throw error;
			console.error('deleteRole:', error);
			return fail(500, { message: 'Impossible de supprimer le rôle' });
		}
	}
};
