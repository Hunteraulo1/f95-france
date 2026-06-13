import { SYSTEM_ROLE_LABELS } from '$lib/permissions/catalog';
import { resolveRoleBadgeStyle } from '$lib/permissions/role-badge-style';
import { selectAllAppRoles } from '$lib/server/app-role-query';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { invalidateRoleBadgeStylesCache } from '$lib/server/role-badge-styles';
import { eq } from 'drizzle-orm';

export type StaffRoleConfigurationIssue = {
	slug: string;
	label: string;
	missingStaff: boolean;
	missingColor: boolean;
};

export async function listStaffRoleConfigurationIssues(
	rolesInput?: Awaited<ReturnType<typeof selectAllAppRoles>>
): Promise<StaffRoleConfigurationIssue[]> {
	const roles = rolesInput ?? (await selectAllAppRoles());
	const issues: StaffRoleConfigurationIssue[] = [];

	for (const role of roles) {
		const resolvedStyle = resolveRoleBadgeStyle(role.slug, role.badgeStyle);
		const missingColor = resolvedStyle === 'default';
		const missingStaff = !role.staff;

		if (role.slug === 'superadmin') {
			if (missingStaff || missingColor) {
				issues.push({
					slug: role.slug,
					label: SYSTEM_ROLE_LABELS[role.slug] ?? role.label,
					missingStaff,
					missingColor
				});
			}
			continue;
		}

		if (role.staff && missingColor) {
			issues.push({
				slug: role.slug,
				label: SYSTEM_ROLE_LABELS[role.slug] ?? role.label,
				missingStaff: false,
				missingColor: true
			});
		}
	}

	return issues;
}

export async function applyStaffRoleConfigurationFix(slug: string): Promise<void> {
	const [role] = await db.select().from(table.appRole).where(eq(table.appRole.slug, slug)).limit(1);

	if (!role) {
		throw new Error('Rôle introuvable');
	}

	const patch: Partial<typeof table.appRole.$inferInsert> = {
		staff: true,
		updatedAt: new Date()
	};

	const resolvedStyle = resolveRoleBadgeStyle(role.slug, role.badgeStyle);
	if (resolvedStyle === 'default') {
		patch.badgeStyle = slug === 'superadmin' ? 'superadmin' : 'primary';
	}

	await db.update(table.appRole).set(patch).where(eq(table.appRole.slug, slug));
	invalidateRoleBadgeStylesCache();
}
