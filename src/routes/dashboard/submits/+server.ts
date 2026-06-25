import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { assertPermission } from '$lib/server/permissions';
import {
	loadSubmissionListPage,
	parseSubmissionStatusFilter
} from '$lib/server/submission-pages';
import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, url }) => {
	await assertPermission(locals, 'submissions.review');

	const statusFilter = parseSubmissionStatusFilter(url.searchParams.get('status'));
	const pageRaw = Number.parseInt(url.searchParams.get('page') ?? '1', 10);
	const requestedPage = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;

	const whereCondition =
		statusFilter === 'all' ? undefined : eq(table.submission.status, statusFilter);

	const result = await loadSubmissionListPage({
		where: whereCondition,
		statusFilter,
		requestedPage,
		includeAdminNotes: true
	});

	return json({
		submissions: result.submissions,
		page: result.page,
		totalPages: result.totalPages,
		total: result.totalCount
	});
};
