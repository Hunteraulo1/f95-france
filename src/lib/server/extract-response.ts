import { EXTRACT_DRAFT_COOKIE } from '$lib/server/extract-draft';
import type { ExtractThreadResult } from '$lib/server/extract-thread-game';
import { json, redirect, type RequestEvent } from '@sveltejs/kit';

export function respondExtractThreadGame(
	event: Pick<RequestEvent, 'cookies' | 'request'>,
	out: ExtractThreadResult,
	mergeHeaders: (h?: HeadersInit) => HeadersInit
): Response {
	if (!out.ok) {
		return json(out.body, { status: out.status, headers: mergeHeaders() });
	}

	if (out.redirectToAdd && out.extractDraft) {
		event.cookies.set(EXTRACT_DRAFT_COOKIE, JSON.stringify(out.extractDraft), {
			path: '/',
			maxAge: 600,
			httpOnly: true,
			sameSite: 'lax'
		});
	}

	const accept = event.request.headers.get('accept') ?? '';
	if (accept.includes('text/html')) {
		return redirect(302, out.redirectPath);
	}

	return json(
		{
			created: out.created,
			gameId: out.gameId,
			redirect: out.redirectPath,
			prefill: out.redirectToAdd ?? false
		},
		{ headers: mergeHeaders() }
	);
}
