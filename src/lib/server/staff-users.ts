import { SYSTEM_ROLE_LABELS } from '$lib/permissions/catalog';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
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
			createdAt: table.user.createdAt
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
