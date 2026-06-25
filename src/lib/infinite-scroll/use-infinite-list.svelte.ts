import { fetchPaginatedJson } from './fetch-paginated-json';

type InfiniteListSeed<T> = {
	items: T[];
	page: number;
	totalPages: number;
};

export function useInfiniteList<T>(config: {
	getInitial: () => InfiniteListSeed<T>;
	getCacheKey: () => string;
	buildUrl: (nextPage: number) => string;
	pickItems: (body: Record<string, unknown>) => T[];
}) {
	const initialSeed = config.getInitial();
	let allItems = $state<T[]>([...initialSeed.items]);
	let loadedPage = $state(initialSeed.page);
	let totalPages = $state(initialSeed.totalPages);
	let loadingMore = $state(false);
	let loadMoreError = $state<string | null>(null);

	const cacheKey = $derived(config.getCacheKey());
	const hasMore = $derived(loadedPage < totalPages);

	$effect(() => {
		String(cacheKey);
		const seed = config.getInitial();
		allItems = [...seed.items];
		loadedPage = seed.page;
		totalPages = seed.totalPages;
		loadMoreError = null;
	});

	async function loadMore() {
		if (loadingMore || !hasMore) return;
		loadingMore = true;
		loadMoreError = null;
		try {
			const result = await fetchPaginatedJson(config.buildUrl(loadedPage + 1), config.pickItems);
			allItems = [...allItems, ...result.items];
			loadedPage = result.page;
			totalPages = result.totalPages;
		} catch {
			loadMoreError = 'Impossible de charger la suite.';
		} finally {
			loadingMore = false;
		}
	}

	return {
		get items() {
			return allItems;
		},
		get hasMore() {
			return hasMore;
		},
		get loadingMore() {
			return loadingMore;
		},
		get loadMoreError() {
			return loadMoreError;
		},
		loadMore
	};
}
