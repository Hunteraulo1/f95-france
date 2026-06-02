import { SYSTEM_ROLE_LABELS } from '$lib/permissions/catalog';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { asc, desc, eq, sql } from 'drizzle-orm';

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
			lastConnectionAt: sql<Date | null>`max(${table.apiLog.createdAt})`
		})
		.from(table.user)
		.innerJoin(table.appRole, eq(table.user.role, table.appRole.slug))
		.leftJoin(table.apiLog, eq(table.apiLog.userId, table.user.id))
		.where(eq(table.appRole.staff, true))
		.groupBy(
			table.user.id,
			table.user.username,
			table.user.email,
			table.user.role,
			table.appRole.label,
			table.appRole.badgeStyle,
			table.user.avatar,
			table.user.createdAt,
			table.appRole.priority
		)
		.orderBy(desc(table.appRole.priority), asc(table.user.username));

	return rows.map((row) => ({
		...row,
		roleLabel: SYSTEM_ROLE_LABELS[row.role] ?? row.roleLabel
	}));
}
