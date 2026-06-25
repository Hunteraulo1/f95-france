import { loadDashboardApiLogsPage } from '$lib/server/dashboard-api-logs-page-load';
import { assertPermission } from '$lib/server/permissions';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, url }) => {
	await assertPermission(locals, 'logs.view', 'Accès refusé');

	const pageRaw = Number.parseInt(url.searchParams.get('page') ?? '1', 10);
	const requestedPage = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;

	const result = await loadDashboardApiLogsPage(url, requestedPage);

	return json({
		logs: result.logs,
		page: result.pagination.page,
		totalPages: result.pagination.totalPages,
		total: result.pagination.totalCount
	});
};
