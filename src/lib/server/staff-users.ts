import { SYSTEM_ROLE_LABELS } from '$lib/permissions/catalog';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import {
	fetchLastApiActivityByUserIds,
	resolveLastConnectionAt
} from '$lib/server/user-last-connection';
import { asc, desc, eq } from 'drizzle-orm';

export type StaffUserListItem = {
	id: string;
	username: string;
	email: string;
	role: string;
	roleLabel: string;
	badgeStyle: string;
	avatar: string;
	createdAt: Date;
	lastConnectionAt: Date | null;
};

/** Staff pour la page d’accueil (sans agrégat `api_log`). */
export async function listStaffUsersForHome(): Promise<
	Pick<StaffUserListItem, 'id' | 'username' | 'avatar' | 'role' | 'roleLabel' | 'badgeStyle'>[]
> {
	const rows = await db
		.select({
			id: table.user.id,
			username: table.user.username,
			role: table.user.role,
			roleLabel: table.appRole.label,
			badgeStyle: table.appRole.badgeStyle,
			avatar: table.user.avatar
		})
		.from(table.user)
		.innerJoin(table.appRole, eq(table.user.role, table.appRole.slug))
		.where(eq(table.appRole.staff, true))
		.orderBy(desc(table.appRole.priority), asc(table.user.username));

	return rows.map((row) => ({
		...row,
		roleLabel: SYSTEM_ROLE_LABELS[row.role] ?? row.roleLabel
	}));
}

/** Utilisateurs staff, triés par force du rôle (`priority`) puis pseudo. */
export async function listStaffUsers(): Promise<StaffUserListItem[]> {
	const rows = await db
		.select({
			id: table.user.id,
			username: table.user.username,
			email: table.user.email,
			role: table.user.role,
			roleLabel: table.appRole.label,
			badgeStyle: table.appRole.badgeStyle,
			avatar: table.user.avatar,
			createdAt: table.user.createdAt,
			lastSeenAt: table.user.lastSeenAt
		})
		.from(table.user)
		.innerJoin(table.appRole, eq(table.user.role, table.appRole.slug))
		.where(eq(table.appRole.staff, true))
		.orderBy(desc(table.appRole.priority), asc(table.user.username));

	const lastApiByUser = await fetchLastApiActivityByUserIds(rows.map((row) => row.id));

	return rows.map((row) => ({
		id: row.id,
		username: row.username,
		email: row.email,
		role: row.role,
		roleLabel: SYSTEM_ROLE_LABELS[row.role] ?? row.roleLabel,
		badgeStyle: row.badgeStyle,
		avatar: row.avatar,
		createdAt: row.createdAt,
		lastConnectionAt: resolveLastConnectionAt(row.lastSeenAt, lastApiByUser.get(row.id) ?? null)
	}));
}
