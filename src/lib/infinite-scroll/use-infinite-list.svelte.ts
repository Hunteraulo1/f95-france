import { untrack } from 'svelte';
import { fetchPaginatedJson } from './fetch-paginated-json';

type InfiniteListSeed<T> = {
	items: T[];
	page: number;
	totalPages: number;
};

export function useInfiniteList<T extends { id: string | number }>(config: {
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
	let lastSeedIds = new Set(initialSeed.items.map((item) => item.id));

	const cacheKey = $derived(config.getCacheKey());
	const hasMore = $derived(loadedPage < totalPages);

	$effect(() => {
		// N'écoute que la clé de cache : lire `config.getInitial()` hors de `untrack`
		// suivrait aussi ses dépendances internes (ex. `data`) et réinitialiserait la
		// liste déjà chargée à chaque rechargement de `data` non lié au filtre
		// (ex. `invalidateAll` après une action sur un item).
		String(cacheKey);
		untrack(() => {
			const seed = config.getInitial();
			allItems = [...seed.items];
			loadedPage = seed.page;
			totalPages = seed.totalPages;
			loadMoreError = null;
			lastSeedIds = new Set(seed.items.map((item) => item.id));
		});
	});

	$effect(() => {
		// Contrairement à l'effet ci-dessus, celui-ci suit `config.getInitial()`
		// directement : un `invalidateAll` à filtre inchangé (ex. après la
		// modification d'une soumission dans sa modal) doit rafraîchir le
		// contenu des items déjà affichés, sans réinitialiser les pages déjà
		// chargées via `loadMore`.
		const seed = config.getInitial();
		untrack(() => {
			const freshIds = new Set(seed.items.map((item) => item.id));
			const freshById = new Map(seed.items.map((item) => [item.id, item]));
			const existingIds = new Set(allItems.map((item) => item.id));

			// Un item qu'on savait présent en page 1 et qui a disparu du jeu frais
			// (ex. changement de statut qui le fait sortir du filtre courant) est
			// retiré. Les items chargés au-delà de la page 1 (`loadMore`) ne sont
			// pas dans `lastSeedIds` : on ne peut pas vérifier leur fraîcheur sans
			// refaire une requête, donc on les laisse tels quels.
			const reconciled = allItems
				.filter((item) => freshById.has(item.id) || !lastSeedIds.has(item.id))
				.map((item) => freshById.get(item.id) ?? item);
			const newItems = seed.items.filter((item) => !existingIds.has(item.id));

			allItems = [...newItems, ...reconciled];
			lastSeedIds = freshIds;
		});
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
