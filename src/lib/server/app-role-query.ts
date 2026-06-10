import { resolveRoleMaxApiKeys } from '$lib/permissions/role-api-keys';
import { resolveRoleBadgeStyle } from '$lib/permissions/role-badge-style';
import { SYSTEM_ROLE_PRIORITIES } from '$lib/permissions/role-priority';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { sql } from 'drizzle-orm';

export type AppRoleRecord = typeof table.appRole.$inferSelect;

function isMissingAppRoleColumn(error: unknown, column: string): boolean {
	if (!error || typeof error !== 'object') return false;
	const e = error as { code?: string; message?: string; cause?: unknown };
	if (e.code === '42703') return true;
	const message = typeof e.message === 'string' ? e.message : '';
	if (message.includes(column)) return true;
	if (e.cause) return isMissingAppRoleColumn(e.cause, column);
	return false;
}

let legacyAppRoleSelect = false;

const STAFF_ROLE_SLUGS = new Set(['admin', 'superadmin']);

async function selectAllAppRolesLegacy(): Promise<AppRoleRecord[]> {
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
		staff: STAFF_ROLE_SLUGS.has(row.slug),
		priority: SYSTEM_ROLE_PRIORITIES[row.slug] ?? 0,
		maxApiKeys: resolveRoleMaxApiKeys(row.slug, null),
		isSystem: row.is_system,
		createdAt: row.created_at,
		updatedAt: row.updated_at
	}));
}

/** Liste les rôles ; repli si des colonnes récentes ne sont pas encore migrées. */
export async function selectAllAppRoles(): Promise<AppRoleRecord[]> {
	if (legacyAppRoleSelect) {
		return selectAllAppRolesLegacy();
	}

	try {
		return await db.select().from(table.appRole);
	} catch (error) {
		if (
			!isMissingAppRoleColumn(error, 'badge_style') &&
			!isMissingAppRoleColumn(error, 'staff') &&
			!isMissingAppRoleColumn(error, 'priority') &&
			!isMissingAppRoleColumn(error, 'max_api_keys')
		) {
			throw error;
		}
		legacyAppRoleSelect = true;
		console.warn(
			'[app_role] Schéma incomplet — exécutez `bun run db:migrate`. Valeurs par défaut utilisées.'
		);
		return selectAllAppRolesLegacy();
	}
}
