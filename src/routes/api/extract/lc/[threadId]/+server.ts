import { respondExtractThreadGame } from '$lib/server/extract-response';
import { corsHeadersExtract, runExtractThreadGame } from '$lib/server/extract-thread-game';
import { type RequestHandler } from '@sveltejs/kit';

const WEBSITE = 'lc' as const;

export const OPTIONS: RequestHandler = async ({ request }) =>
	new Response(null, { status: 204, headers: corsHeadersExtract(request, WEBSITE) });

export const GET: RequestHandler = async (event) => {
	const out = await runExtractThreadGame({
		locals: event.locals,
		threadIdParam: event.params.threadId,
		method: 'GET',
		request: event.request,
		website: WEBSITE
	});
	const mergeHeaders = (h: HeadersInit = {}) => ({
		...corsHeadersExtract(event.request, WEBSITE),
		...h
	});

	return respondExtractThreadGame(event, out, mergeHeaders);
};

export const POST: RequestHandler = async (event) => {
	const out = await runExtractThreadGame({
		locals: event.locals,
		threadIdParam: event.params.threadId,
		method: 'POST',
		request: event.request,
		website: WEBSITE
	});
	const mergeHeaders = (h: HeadersInit = {}) => ({
		...corsHeadersExtract(event.request, WEBSITE),
		...h
	});

	return respondExtractThreadGame(event, out, mergeHeaders);
};
