import { assertDashboardAuthenticated } from '$lib/server/dashboard-auth';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import {
	loadSubmissionListPage,
	parseSubmissionStatusFilter
} from '$lib/server/submission-pages';
import { json } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, url }) => {
	assertDashboardAuthenticated(locals);

	const statusFilter = parseSubmissionStatusFilter(url.searchParams.get('status'));
	const pageRaw = Number.parseInt(url.searchParams.get('page') ?? '1', 10);
	const requestedPage = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;

	const whereCondition =
		statusFilter === 'all'
			? eq(table.submission.userId, locals.user!.id)
			: and(
					eq(table.submission.userId, locals.user!.id),
					eq(table.submission.status, statusFilter)
				);

	const result = await loadSubmissionListPage({
		where: whereCondition,
		statusFilter,
		requestedPage,
		userId: locals.user!.id
	});

	return json({
		submissions: result.submissions,
		page: result.page,
		totalPages: result.totalPages,
		total: result.totalCount
	});
};
