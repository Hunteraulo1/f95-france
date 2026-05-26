import { resolveRoleBadgeStyle } from '$lib/permissions/role-badge-style';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { sql } from 'drizzle-orm';

export type AppRoleRecord = typeof table.appRole.$inferSelect;

function isMissingBadgeStyleColumn(error: unknown): boolean {
	if (!error || typeof error !== 'object') return false;
	const e = error as { code?: string; message?: string; cause?: unknown };
	if (e.code === '42703') return true;
	const message = typeof e.message === 'string' ? e.message : '';
	if (message.includes('badge_style')) return true;
	if (e.cause) return isMissingBadgeStyleColumn(e.cause);
	return false;
}

let badgeStyleColumnMissing = false;

async function selectAllAppRolesWithoutBadgeStyle(): Promise<AppRoleRecord[]> {
	const rows = (await db.execute(sql`
		SELECT slug, label, description, edit_mode, is_system, created_at, updated_at
		FROM app_role
	`)) as Array<{
		slug: string;
		label: string;
		description: string | null;
		edit_mode: string;
		is_system: boolean;
		created_at: Date;
		updated_at: Date;
	}>;

	return rows.map((row) => ({
		slug: row.slug,
		label: row.label,
		description: row.description,
		editMode: row.edit_mode,
		badgeStyle: resolveRoleBadgeStyle(row.slug, null),
		isSystem: row.is_system,
		createdAt: row.created_at,
		updatedAt: row.updated_at
	}));
}

/** Liste les rôles ; repli si la migration `badge_style` n’est pas encore appliquée. */
export async function selectAllAppRoles(): Promise<AppRoleRecord[]> {
	if (badgeStyleColumnMissing) {
		return selectAllAppRolesWithoutBadgeStyle();
	}

	try {
		return await db.select().from(table.appRole);
	} catch (error) {
		if (!isMissingBadgeStyleColumn(error)) throw error;
		badgeStyleColumnMissing = true;
		console.warn(
			'[app_role] Colonne badge_style absente — exécutez `npm run db:migrate`. Couleurs par défaut utilisées.'
		);
		return selectAllAppRolesWithoutBadgeStyle();
	}
}
