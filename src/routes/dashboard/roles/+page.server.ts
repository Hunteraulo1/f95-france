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
import {
	parseRoleMaxApiKeysInput,
	resolveRoleMaxApiKeys,
	ROLE_API_KEYS_MAX,
	ROLE_API_KEYS_MIN,
	USER_API_KEY_MAX_COUNT_DEFAULT
} from '$lib/permissions/role-api-keys';
import { resolveRoleBadgeStyle, ROLE_BADGE_STYLE_OPTIONS } from '$lib/permissions/role-badge-style';
import {
	parseRolePriorityInput,
	ROLE_PRIORITY_MAX,
	ROLE_PRIORITY_MIN
} from '$lib/permissions/role-priority';
import { sortRolesByPriority } from '$lib/permissions/sort-roles';
import { formatUserEmailForDisplay } from '$lib/permissions/user-email';
import { selectAllAppRoles } from '$lib/server/app-role-query';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import {
	assertPermission,
	countUsersWithRoles,
	getEffectivePermissionsByRoles,
	hasPermission,
	invalidateRolePermissionsCache,
	listRolePermissions,
	listRolePermissionsStored,
	roleExists,
	setRolePermissions
} from '$lib/server/permissions';
import {
	invalidateRoleBadgeStylesCache,
	parseRoleBadgeStyleInput
} from '$lib/server/role-badge-styles';
import {
	assertCanManageRole,
	canAssignAllRolePermissions,
	filterPermissionsAssignableByActor,
	getActorPermissionSet
} from '$lib/server/role-management-guard';
import {
	applyStaffRoleConfigurationFix,
	listStaffRoleConfigurationIssues
} from '$lib/server/staff-role-configuration';
import { listStaffUsers } from '$lib/server/staff-users';
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

function enrichRoleRow(
	r: Awaited<ReturnType<typeof selectAllAppRoles>>[number],
	effectivePerms: string[],
	userCounts: Record<string, number>,
	access: Awaited<ReturnType<typeof assertCanManageRole>>
) {
	const hasGamesManage = effectivePerms.includes(GAMES_MANAGE_PERMISSION);
	const storedEditMode = r.editMode && isRoleEditMode(r.editMode) ? r.editMode : null;
	const badgeStyle = resolveRoleBadgeStyle(r.slug, r.badgeStyle);
	return {
		...r,
		label: SYSTEM_ROLE_LABELS[r.slug] ?? r.label,
		hasGamesManage,
		storedEditMode,
		badgeStyle,
		maxApiKeys: resolveRoleMaxApiKeys(r.slug, r.maxApiKeys),
		editMode: resolveEffectiveRoleEditMode(storedEditMode, hasGamesManage),
		userCount: userCounts[r.slug] ?? 0,
		permissionCount: effectivePerms.length,
		canManage: access.allowed,
		manageBlockedReason: access.allowed ? null : access.message
	};
}

export const load: PageServerLoad = async ({ locals, url }) => {
	await assertPermission(locals, 'roles.manage');

	const canViewUserEmails = hasPermission(locals, 'users.view_email');

	const rolesRaw = await selectAllAppRoles();
	const roleSlugs = rolesRaw.map((r) => r.slug);
	const [userCounts, effectivePermsBySlug, staffUsers, staffRoleIssues] = await Promise.all([
		countUsersWithRoles(roleSlugs),
		getEffectivePermissionsByRoles(roleSlugs),
		listStaffUsers(),
		listStaffRoleConfigurationIssues(rolesRaw)
	]);
	const roles = sortRolesByPriority(rolesRaw);
	const defaultSlug = roles[0]?.slug ?? 'user';
	const roleParam = url.searchParams.get('role');

	if (!roleParam) {
		redirect(303, rolePageUrl(defaultSlug));
	}

	const selectedSlug = roleSlugs.includes(roleParam) ? roleParam : defaultSlug;
	if (selectedSlug !== roleParam) {
		redirect(303, rolePageUrl(selectedSlug));
	}
	const isSelectedRoleSuperadmin = isSuperadminRole(selectedSlug);
	const selectedPermissionsEffective = effectivePermsBySlug[selectedSlug] ?? [];
	const selectedPermissions = isSelectedRoleSuperadmin
		? [...selectedPermissionsEffective]
		: await listRolePermissionsStored(selectedSlug);

	const canAssignAll = canAssignAllRolePermissions(locals);
	const actorPermissions = await getActorPermissionSet(locals);

	const rolesWithAccess = await Promise.all(
		roles.map(async (r) => {
			const effectivePerms = effectivePermsBySlug[r.slug] ?? [];
			const access = canAssignAll
				? ({ allowed: true } as const)
				: await assertCanManageRole(locals, r.slug, effectivePerms);
			return enrichRoleRow(r, effectivePerms, userCounts, access);
		})
	);

	const permissionGroups = [...permissionCatalogGrouped().entries()]
		.map(([group, items]) => ({
			group,
			items:
				isSelectedRoleSuperadmin || canAssignAll
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

	const canEditRolePriority = isSuperadminRole(locals.user?.role);
	const canFixStaffRoles = isSuperadminRole(locals.user?.role);

	return {
		canAssignAllPermissions: canAssignAll,
		canEditRolePriority,
		canFixStaffRoles,
		staffRoleIssues,
		isSelectedRoleSuperadmin,
		rolePriorityMin: ROLE_PRIORITY_MIN,
		rolePriorityMax: ROLE_PRIORITY_MAX,
		roleApiKeysMin: ROLE_API_KEYS_MIN,
		roleApiKeysMax: ROLE_API_KEYS_MAX,
		staffUsers: staffUsers.map((member) => ({
			...member,
			email: formatUserEmailForDisplay(member.email, canViewUserEmails)
		})),
		roles: rolesWithAccess,
		noticeMessage,
		selectedSlug,
		selectedPermissions,
		selectedPermissionDetails,
		selectedCanManage: selectedRoleMeta?.canManage ?? false,
		selectedManageBlockedReason: selectedRoleMeta?.manageBlockedReason ?? null,
		permissionGroups,
		allPermissionKeys: PERMISSION_CATALOG.map((p) => p.key),
		editModeOptions: ROLE_EDIT_MODE_OPTIONS,
		badgeStyleOptions: ROLE_BADGE_STYLE_OPTIONS
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
		const badgeStyle = parseRoleBadgeStyleInput(String(formData.get('badgeStyle') ?? ''));
		if (!badgeStyle) {
			return fail(400, { message: 'Couleur de rôle invalide' });
		}
		const staff = formData.has('staff') && formData.get('staff') === 'on';
		const canEditPriority = isSuperadminRole(locals.user?.role);
		let priority = 0;
		if (canEditPriority && formData.has('priority')) {
			const parsedPriority = parseRolePriorityInput(formData.get('priority'));
			if (parsedPriority === null) {
				return fail(400, {
					message: `Force du rôle invalide (${ROLE_PRIORITY_MIN}–${ROLE_PRIORITY_MAX})`
				});
			}
			priority = parsedPriority;
		}
		const parsedMaxApiKeys = parseRoleMaxApiKeysInput(formData.get('maxApiKeys'));
		const maxApiKeys = parsedMaxApiKeys ?? USER_API_KEY_MAX_COUNT_DEFAULT;
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

		const canAssignAll = canAssignAllRolePermissions(locals);
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
			canAssignAll
		);
		if (!canAssignAll && rejected.length > 0) {
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
				badgeStyle,
				staff,
				priority,
				maxApiKeys,
				isSystem: false
			});
			await setRolePermissions(slug, assignableInitial);
			invalidateRoleBadgeStylesCache();
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

		const parsedMaxApiKeys = parseRoleMaxApiKeysInput(formData.get('maxApiKeys'));
		if (parsedMaxApiKeys === null) {
			return fail(400, {
				message: `Nombre de clés API invalide (${ROLE_API_KEYS_MIN}–${ROLE_API_KEYS_MAX})`
			});
		}

		if (isSuperadminRole(slug)) {
			if (!isSuperadminRole(locals.user?.role)) {
				return fail(403, {
					message:
						'Seul un super administrateur peut modifier la limite de clés API du rôle Super administrateur'
				});
			}

			try {
				await db
					.update(table.appRole)
					.set({ maxApiKeys: parsedMaxApiKeys, updatedAt: new Date() })
					.where(eq(table.appRole.slug, slug));
				redirect(303, rolePageUrl(slug, 'updated'));
			} catch (error) {
				if (isRedirect(error)) throw error;
				console.error('updateRole (superadmin maxApiKeys):', error);
				return fail(500, { message: 'Impossible de mettre à jour le rôle' });
			}
		}

		const badgeStyle =
			parseRoleBadgeStyleInput(String(formData.get('badgeStyle') ?? '')) ??
			resolveRoleBadgeStyle(slug, role.badgeStyle);
		const guard = await rejectUnlessCanManageRole(locals, slug);
		if (!guard.ok) return fail(403, { message: guard.message });

		const rolePermissions = await listRolePermissions(slug);
		const hasGamesManage = rolePermissions.includes(GAMES_MANAGE_PERMISSION);
		if (hasGamesManage && !editMode) {
			return fail(400, { message: 'Mode d’enregistrement invalide' });
		}

		const staff = formData.has('staff') ? formData.get('staff') === 'on' : role.staff;
		const canEditPriority = isSuperadminRole(locals.user?.role);
		let priorityPatch: { priority?: number } = {};
		if (canEditPriority && formData.has('priority')) {
			const parsedPriority = parseRolePriorityInput(formData.get('priority'));
			if (parsedPriority === null) {
				return fail(400, {
					message: `Force du rôle invalide (${ROLE_PRIORITY_MIN}–${ROLE_PRIORITY_MAX})`
				});
			}
			priorityPatch = { priority: parsedPriority };
		}

		try {
			await db
				.update(table.appRole)
				.set({
					label: role.isSystem ? (SYSTEM_ROLE_LABELS[slug] ?? label) : label,
					description: role.isSystem ? role.description : description,
					badgeStyle,
					staff,
					maxApiKeys: parsedMaxApiKeys,
					...priorityPatch,
					...(hasGamesManage && editMode ? { editMode } : {}),
					updatedAt: new Date()
				})
				.where(eq(table.appRole.slug, slug));
			invalidateRolePermissionsCache(slug);
			invalidateRoleBadgeStylesCache();

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

		const canAssignAll = canAssignAllRolePermissions(locals);
		const actorPermissions = await getActorPermissionSet(locals);
		const { keys, rejected } = filterPermissionsAssignableByActor(
			actorPermissions,
			requested,
			canAssignAll
		);

		if (!canAssignAll && rejected.length > 0) {
			return fail(403, {
				message: 'Vous ne pouvez pas attribuer des droits que vous ne possédez pas'
			});
		}

		const storedKeys = await listRolePermissionsStored(slug);
		const preservedKeys = canAssignAll
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
			invalidateRoleBadgeStylesCache();
			const remaining = await selectAllAppRoles();
			const nextSlug = sortRolesByPriority(remaining)[0]?.slug ?? 'user';
			redirect(303, rolePageUrl(nextSlug, 'deleted'));
		} catch (error) {
			if (isRedirect(error)) throw error;
			console.error('deleteRole:', error);
			return fail(500, { message: 'Impossible de supprimer le rôle' });
		}
	},

	fixStaffRole: async ({ request, locals }) => {
		await assertPermission(locals, 'roles.manage');

		if (!isSuperadminRole(locals.user?.role)) {
			return fail(403, { message: 'Réservé aux super administrateurs' });
		}

		const slug = String((await request.formData()).get('slug') ?? '').trim();
		if (!slug) {
			return fail(400, { message: 'Rôle requis' });
		}

		try {
			await applyStaffRoleConfigurationFix(slug);
			return { success: true, fixedSlug: slug };
		} catch (error) {
			console.error('fixStaffRole:', error);
			return fail(500, { message: 'Impossible de corriger ce rôle' });
		}
	}
};
