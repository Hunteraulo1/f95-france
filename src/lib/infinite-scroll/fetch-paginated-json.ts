/** Charge une page JSON depuis une route SvelteKit (`+server.ts` GET). */
export async function fetchPaginatedJson<TItem>(
	url: string,
	pickItems: (body: Record<string, unknown>) => TItem[]
): Promise<{ items: TItem[]; page: number; totalPages: number; total: number }> {
	const res = await fetch(url, {
		headers: { Accept: 'application/json' },
		credentials: 'same-origin'
	});
	if (!res.ok) throw new Error(`fetch_failed_${res.status}`);

	const body = (await res.json()) as Record<string, unknown>;
	const page = typeof body.page === 'number' ? body.page : 1;
	const totalPages = typeof body.totalPages === 'number' ? body.totalPages : 1;
	const total = typeof body.total === 'number' ? body.total : 0;

	return { items: pickItems(body), page, totalPages, total };
}
