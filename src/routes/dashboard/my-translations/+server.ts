import { assertDashboardAuthenticated } from '$lib/server/dashboard-auth';
import { loadDashboardMyTranslationsPage } from '$lib/server/dashboard-my-translations-page-load';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, url, cookies }) => {
	assertDashboardAuthenticated(locals);

	const statusFilterRaw = (
		url.searchParams.get('status') ??
		cookies.get('mt_status') ??
		'all'
	).trim();
	const statusFilter =
		statusFilterRaw === 'in_progress' ||
		statusFilterRaw === 'completed' ||
		statusFilterRaw === 'abandoned'
			? statusFilterRaw
			: 'all';

	const roleFilterRaw = (url.searchParams.get('role') ?? cookies.get('mt_role') ?? 'all').trim();
	const roleFilter =
		roleFilterRaw === 'translator' || roleFilterRaw === 'proofreader' ? roleFilterRaw : 'all';

	const q = (url.searchParams.get('q') ?? '').trim().slice(0, 100);
	const pageRaw = Number.parseInt(url.searchParams.get('page') ?? '1', 10);
	const requestedPage = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;

	const result = await loadDashboardMyTranslationsPage({
		locals,
		filters: { statusFilter, roleFilter, q },
		requestedPage
	});

	return json({
		translations: result.translations,
		page: result.page,
		totalPages: result.totalPages,
		total: result.totalCount
	});
};
