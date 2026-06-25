import { formatUserEmailForDisplay } from '$lib/permissions/user-email';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { getRoleEditMode } from '$lib/server/role-edit-mode';
import { resolveTranslatorPagesWriteMode } from '$lib/server/translator-pages-write';
import { hasPermission } from '$lib/server/permissions';
import { and, eq, like, or, sql } from 'drizzle-orm';

export const DASHBOARD_TRANSLATORS_PAGE_SIZE = 20;

const escapeIlike = (s: string) => s.replace(/[\\%_]/g, (m) => `\\${m}`);

export async function loadDashboardTranslatorsPage(options: {
	locals: App.Locals;
	q: string;
	requestedPage: number;
}) {
	const { locals, q, requestedPage } = options;

	const canManageTranslators = hasPermission(locals, 'translators.manage');
	const canViewUserEmails = hasPermission(locals, 'users.view_email');
	const hasGamesManage = hasPermission(locals, 'games.manage');
	const roleEditMode = hasGamesManage ? await getRoleEditMode(locals.user!.role) : null;

	const conditions = [];
	if (!canManageTranslators) {
		conditions.push(eq(table.translator.userId, locals.user!.id));
	}
	if (q) {
		const pattern = `%${escapeIlike(q)}%`;
		conditions.push(
			or(like(table.translator.name, pattern), like(table.translator.discordId, pattern))
		);
	}
	const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

	const countBase = db.select({ count: sql<number>`count(*)`.as('count') }).from(table.translator);
	const [countRow] = await (whereClause ? countBase.where(whereClause) : countBase);

	const totalCount = Number(countRow?.count ?? 0);
	const totalPages = Math.max(1, Math.ceil(totalCount / DASHBOARD_TRANSLATORS_PAGE_SIZE));
	const page = Math.min(requestedPage, totalPages);
	const offset = (page - 1) * DASHBOARD_TRANSLATORS_PAGE_SIZE;

	const listBase = db
		.select({
			id: table.translator.id,
			name: table.translator.name,
			discordId: table.translator.discordId,
			pages: table.translator.pages,
			userId: table.translator.userId
		})
		.from(table.translator);
	const translators = await (whereClause ? listBase.where(whereClause) : listBase)
		.orderBy(table.translator.name)
		.limit(DASHBOARD_TRANSLATORS_PAGE_SIZE)
		.offset(offset);

	const users = canManageTranslators
		? await db
				.select({
					id: table.user.id,
					username: table.user.username,
					email: table.user.email
				})
				.from(table.user)
				.orderBy(table.user.username)
		: [];

	const translator = translators.map((row) => ({
		...row,
		pages: JSON.parse(row.pages || '[]') as { name: string; link: string }[]
	}));

	const translatorPagesWriteMode = await resolveTranslatorPagesWriteMode({
		hasGamesManage,
		roleSlug: locals.user!.role,
		userDirectMode: locals.user!.directMode ?? true
	});

	const usersForClient = users.map((u) => ({
		...u,
		email: formatUserEmailForDisplay(u.email, canViewUserEmails)
	}));

	return {
		translator,
		users: usersForClient,
		canManageTranslators,
		canViewUserEmails,
		hasGamesManage,
		roleEditMode,
		translatorPagesWriteMode,
		directMode: locals.user!.directMode ?? true,
		currentUserId: locals.user!.id,
		q,
		page,
		pageSize: DASHBOARD_TRANSLATORS_PAGE_SIZE,
		totalCount,
		totalPages
	};
}
