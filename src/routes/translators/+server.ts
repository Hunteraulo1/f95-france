import { listPublicTranslators } from '$lib/server/public-translators';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const q = (url.searchParams.get('q') ?? '').trim().slice(0, 100);
	const pageRaw = Number.parseInt(url.searchParams.get('page') ?? '1', 10);
	const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
	const result = await listPublicTranslators({ query: q, page });
	return json(result);
};
