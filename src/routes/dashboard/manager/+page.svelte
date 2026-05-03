<script lang="ts">
	import type { Game } from '$lib/server/db/schema';
	import { getGameEngineHexColor, getGameEngineLabel } from '$lib/utils/game-engine-colors';
	import { resolveGameImageSrc } from '$lib/utils/game-image-url';

	type GameSearchHit = Game & { engineTypes: string[] };
	import Plus from '@lucide/svelte/icons/plus';
	import Search from '@lucide/svelte/icons/search';
	import X from '@lucide/svelte/icons/x';

	/** Attente après la dernière frappe avant d’appeler l’API (limite le nombre de requêtes). */
	const SEARCH_DEBOUNCE_MS = 450;

	let searchQuery = $state('');
	let searchResults = $state<GameSearchHit[]>([]);
	let isLoading = $state(false);
	let showResults = $state(false);
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	/** Incrémenté à chaque recherche lancée : ignore les réponses d’une requête plus ancienne. */
	let searchGeneration = 0;

	const searchGames = async (query: string, generation: number) => {
		if (!query || query.trim().length < 1) {
			searchResults = [];
			showResults = false;
			return;
		}

		isLoading = true;
		try {
			const response = await fetch(`/dashboard/manager?q=${encodeURIComponent(query)}`);
			const data = await response.json();

			if (generation !== searchGeneration) return;

			if (response.ok) {
				searchResults = data.games;
				showResults = true;
			} else {
				console.error('Erreur lors de la recherche:', data.error);
				searchResults = [];
			}
		} catch (error) {
			if (generation !== searchGeneration) return;
			console.error('Erreur lors de la recherche:', error);
			searchResults = [];
		} finally {
			if (generation === searchGeneration) {
				isLoading = false;
			}
		}
	};

	const debouncedSearch = (query: string) => {
		if (debounceTimer) {
			clearTimeout(debounceTimer);
		}

		debounceTimer = setTimeout(() => {
			debounceTimer = null;
			const trimmed = query.trim();
			if (trimmed.length < 1) {
				searchResults = [];
				showResults = false;
				isLoading = false;
				return;
			}
			const gen = ++searchGeneration;
			void searchGames(query, gen);
		}, SEARCH_DEBOUNCE_MS);
	};

	const clearSearch = () => {
		searchQuery = '';
		searchResults = [];
		showResults = false;
		searchGeneration += 1;
		isLoading = false;
		if (debounceTimer) {
			clearTimeout(debounceTimer);
			debounceTimer = null;
		}
	};

	const handleInput = (event: Event) => {
		const target = event.target as HTMLInputElement;
		searchQuery = target.value;
		debouncedSearch(searchQuery);
	};

	const getAddGameHref = () => {
		const q = searchQuery.trim();
		const maybeThreadId = Number.parseInt(q, 10);
		const isNumericId = q.length > 0 && !Number.isNaN(maybeThreadId) && maybeThreadId > 0;
		if (isNumericId) {
			return `/dashboard/manager/add?threadId=${encodeURIComponent(String(maybeThreadId))}`;
		}
		return '/dashboard/manager/add';
	};
</script>

<section>
	<h2 class="mb-4 text-lg font-semibold text-base-content">Ajouter/Modifier un jeu sur la liste</h2>

	<div class="card w-full items-center justify-between gap-4 bg-base-100 p-8 shadow-sm">
		<div class="flex w-full flex-col-reverse justify-between gap-4 md:items-center lg:flex-row">
			<div class="relative w-full">
				<label class="input w-full">
					<Search size={20} class="min-w-5" />
					<input
						type="search"
						class="input-ghost"
						placeholder="Rechercher un jeu par nom ou threadId..."
						oninput={handleInput}
					/>
					{#if searchQuery}
						<button type="button" class="btn btn-ghost btn-sm" onclick={clearSearch}>
							<X size={16} />
						</button>
					{/if}
					<kbd class="kbd px-2 kbd-sm">ctrl</kbd>
					<kbd class="kbd kbd-sm">K</kbd>
				</label>

				{#if showResults}
					<div
						class="absolute top-full right-0 left-0 z-50 mt-2 max-h-96 overflow-y-auto rounded-lg border border-base-300 bg-base-100 shadow-lg"
					>
						{#if isLoading}
							<div class="p-4 text-center">
								<span class="loading loading-sm loading-spinner"></span>
								<span class="ml-2">Recherche en cours...</span>
							</div>
						{:else if searchResults.length === 0}
							<div class="p-4 text-center text-base-content/60">Aucun jeu trouvé</div>
						{:else}
							{#each searchResults as game (game.id)}
								<a
									href="/dashboard/game/{game.id}"
									class="block cursor-pointer border-b border-base-300 p-4 last:border-b-0 hover:bg-base-200"
								>
									<div class="flex items-start gap-3">
										<img
											src={resolveGameImageSrc(game.image, { website: game.website })}
											alt={game.name}
											class="h-12 w-12 rounded object-cover"
											loading="lazy"
											referrerpolicy="no-referrer"
										/>
										<div class="min-w-0 flex-1">
											<h3 class="truncate text-base font-semibold">{game.name}</h3>
											<p class="truncate text-sm text-base-content/70">
												{game.description || 'Aucune description'}
											</p>
											<div class="mt-1 flex flex-wrap items-center gap-2">
												{#if game.engineTypes.length > 0}
													{#each game.engineTypes as eng (eng)}
														<span
															class="badge badge-sm border-0 text-white"
															style="background-color: {getGameEngineHexColor(eng)}"
															>{getGameEngineLabel(eng)}</span
														>
													{/each}
												{:else}
													<span class="badge badge-ghost badge-sm">Aucun</span>
												{/if}
												{#if game.tags}
													<span class="truncate text-xs text-base-content/60">{game.tags}</span>
												{/if}
											</div>
										</div>
									</div>
								</a>
							{/each}
						{/if}
					</div>
				{/if}
			</div>
			<a href={getAddGameHref()} class="btn btn-primary">
				<Plus size={16} />
				AJOUTER UN JEU
			</a>
		</div>
	</div>
</section>
