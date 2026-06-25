import { assertDashboardAuthenticated } from '$lib/server/dashboard-auth';
import { loadDashboardTranslatorsPage } from '$lib/server/dashboard-translators-page-load';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, url }) => {
	assertDashboardAuthenticated(locals);

	const q = (url.searchParams.get('q') ?? '').trim().slice(0, 100);
	const pageRaw = Number.parseInt(url.searchParams.get('page') ?? '1', 10);
	const requestedPage = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;

	const result = await loadDashboardTranslatorsPage({ locals, q, requestedPage });

	return json({
		translator: result.translator,
		page: result.page,
		totalPages: result.totalPages,
		total: result.totalCount
	});
};
