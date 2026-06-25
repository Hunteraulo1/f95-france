import { listPublicUpdates } from '$lib/server/public-updates';
import { parsePublicUpdatesListParams } from '$lib/updates/updates-filter-url';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const params = parsePublicUpdatesListParams(url.searchParams);
	const result = await listPublicUpdates(params);
	return json(result);
};
