<script lang="ts">
	import type { Game } from '$lib/server/db/schema';
	import { Plus, Search, X } from '@lucide/svelte';

	let searchQuery = $state('');
	let searchResults = $state<Game[]>([]);
	let isLoading = $state(false);
	let showResults = $state(false);
	let searchTimeout: ReturnType<typeof setTimeout> | null = null;

	const searchGames = async (query: string) => {
		if (!query || query.trim().length < 1) {
			searchResults = [];
			showResults = false;
			return;
		}

		isLoading = true;
		try {
			const response = await fetch(`/dashboard/manager?q=${encodeURIComponent(query)}`);
			const data = await response.json();

			if (response.ok) {
				searchResults = data.games;
				showResults = true;
			} else {
				console.error('Erreur lors de la recherche:', data.error);
				searchResults = [];
			}
		} catch (error) {
			console.error('Erreur lors de la recherche:', error);
			searchResults = [];
		} finally {
			isLoading = false;
		}
	};

	const debouncedSearch = (query: string) => {
		if (searchTimeout) {
			clearTimeout(searchTimeout);
		}

		searchTimeout = setTimeout(() => {
			searchGames(query);
		}, 500);
	};

	const clearSearch = () => {
		searchQuery = '';
		searchResults = [];
		showResults = false;
		if (searchTimeout) {
			clearTimeout(searchTimeout);
			searchTimeout = null;
		}
	};

	const handleInput = (event: Event) => {
		const target = event.target as HTMLInputElement;
		searchQuery = target.value;
		debouncedSearch(searchQuery);
	};
</script>

<section>
	<h2 class="mb-4 text-lg font-semibold text-base-content">Ajouter/Modifier un jeu sur la liste</h2>

	<div class="card w-full items-center justify-between gap-4 bg-base-100 p-8 shadow-sm">
		<div class="flex w-full items-center justify-between gap-4">
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
											src={game.image}
											alt={game.name}
											class="h-12 w-12 rounded object-cover"
											loading="lazy"
										/>
										<div class="min-w-0 flex-1">
											<h3 class="truncate text-base font-semibold">{game.name}</h3>
											<p class="truncate text-sm text-base-content/70">
												{game.description || 'Aucune description'}
											</p>
											<div class="mt-1 flex items-center gap-2">
												<span class="badge badge-outline badge-sm">{game.type}</span>
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
			<a href="/dashboard/manager/add" class="btn btn-primary">
				<Plus size={16} />
				AJOUTER UN JEU
			</a>
		</div>
	</div>
</section>
