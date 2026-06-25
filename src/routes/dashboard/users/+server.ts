import { assertPermission } from '$lib/server/permissions';
import { loadDashboardUsersPage } from '$lib/server/dashboard-users-page-load';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, url }) => {
	await assertPermission(locals, 'users.manage');

	const q = (url.searchParams.get('q') ?? '').trim().slice(0, 100);
	const pageRaw = Number.parseInt(url.searchParams.get('page') ?? '1', 10);
	const requestedPage = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;

	const result = await loadDashboardUsersPage({ locals, q, requestedPage });

	return json({
		users: result.users,
		page: result.page,
		totalPages: result.totalPages,
		total: result.totalUsers
	});
};
