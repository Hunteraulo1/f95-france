import { corsHeadersExtract, runExtractThreadGame } from '$lib/server/extract-thread-game';
import { json, redirect, type RequestHandler } from '@sveltejs/kit';

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
	const mergeHeaders = (h: HeadersInit = {}) => ({ ...corsHeadersExtract(event.request, WEBSITE), ...h });

	if (!out.ok) {
		return json(out.body, { status: out.status, headers: mergeHeaders() });
	}

	const accept = event.request.headers.get('accept') ?? '';
	if (accept.includes('text/html')) {
		return redirect(302, out.redirectPath);
	}

	return json(
		{ created: out.created, gameId: out.gameId, redirect: out.redirectPath },
		{ headers: mergeHeaders() }
	);
};

export const POST: RequestHandler = async (event) => {
	const out = await runExtractThreadGame({
		locals: event.locals,
		threadIdParam: event.params.threadId,
		method: 'POST',
		request: event.request,
		website: WEBSITE
	});
	const mergeHeaders = (h: HeadersInit = {}) => ({ ...corsHeadersExtract(event.request, WEBSITE), ...h });

	if (!out.ok) {
		return json(out.body, { status: out.status, headers: mergeHeaders() });
	}

	return json(
		{ created: out.created, gameId: out.gameId, redirect: out.redirectPath },
		{ headers: mergeHeaders() }
	);
};
