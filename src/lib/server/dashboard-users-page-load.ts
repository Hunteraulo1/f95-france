import { SYSTEM_ROLE_LABELS } from '$lib/permissions/catalog';
import { formatUserEmailForDisplay } from '$lib/permissions/user-email';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { hasPermission, listAppRoles } from '$lib/server/permissions';
import {
	fetchLastApiActivityByUserIds,
	resolveLastConnectionAt
} from '$lib/server/user-last-connection';
import { listRolesAssignableToUsers } from '$lib/server/user-role-assignment-guard';
import { like, or, sql } from 'drizzle-orm';

export const DASHBOARD_USERS_PAGE_SIZE = 20;

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (m) => `\\${m}`);

export async function loadDashboardUsersPage(options: {
	locals: App.Locals;
	q: string;
	requestedPage: number;
}) {
	const { locals, q, requestedPage } = options;

	const canViewUserEmails = hasPermission(locals, 'users.view_email');

	const searchWhere = q
		? or(
				like(table.user.username, `%${escapeLike(q)}%`),
				...(canViewUserEmails ? [like(table.user.email, `%${escapeLike(q)}%`)] : [])
			)
		: undefined;

	const countBase = db.select({ count: sql<number>`count(*)`.as('count') }).from(table.user);
	const translatorsListPromise = db
		.select({
			id: table.translator.id,
			name: table.translator.name,
			userId: table.translator.userId
		})
		.from(table.translator)
		.orderBy(table.translator.name);

	const [[totalUsersResult], translatorsList] = await Promise.all([
		searchWhere ? countBase.where(searchWhere) : countBase,
		translatorsListPromise
	]);

	const totalUsers = Number(totalUsersResult?.count ?? 0);
	const totalPages = Math.max(1, Math.ceil(totalUsers / DASHBOARD_USERS_PAGE_SIZE));
	const page = Math.min(requestedPage, totalPages);
	const offset = (page - 1) * DASHBOARD_USERS_PAGE_SIZE;

	const listBase = db
		.select({
			id: table.user.id,
			username: table.user.username,
			email: table.user.email,
			role: table.user.role,
			avatar: table.user.avatar,
			createdAt: table.user.createdAt,
			lastSeenAt: table.user.lastSeenAt
		})
		.from(table.user);

	const users = await (searchWhere ? listBase.where(searchWhere) : listBase)
		.orderBy(table.user.createdAt)
		.limit(DASHBOARD_USERS_PAGE_SIZE)
		.offset(offset);

	const lastApiActivityByUserId = await fetchLastApiActivityByUserIds(users.map((u) => u.id));
	const now = new Date();
	const usersWithLiveLastConnection = users.map((u) => ({
		id: u.id,
		username: u.username,
		email: u.email,
		role: u.role,
		avatar: u.avatar,
		createdAt: u.createdAt,
		lastConnectionAt:
			u.id === locals.user?.id
				? now
				: resolveLastConnectionAt(u.lastSeenAt, lastApiActivityByUserId.get(u.id))
	}));

	const appRoles = await listAppRoles();
	const roles = await listRolesAssignableToUsers(
		locals,
		appRoles.map((r) => ({
			slug: r.slug,
			label: SYSTEM_ROLE_LABELS[r.slug] ?? r.label,
			isSystem: r.isSystem
		}))
	);

	const usersForClient = usersWithLiveLastConnection.map((u) => ({
		...u,
		email: formatUserEmailForDisplay(u.email, canViewUserEmails)
	}));

	return {
		users: usersForClient,
		translators: translatorsList,
		roles,
		canViewUserEmails,
		canAssignAdmin: hasPermission(locals, 'users.assign_admin'),
		q,
		totalUsers,
		page,
		pageSize: DASHBOARD_USERS_PAGE_SIZE,
		totalPages
	};
}
