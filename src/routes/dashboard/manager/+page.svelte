<script lang="ts">
	import type { Game } from '$lib/server/db/schema';
	import { Plus, Search, X } from '@lucide/svelte';

	let searchQuery = $state('');
	let searchResults = $state<Game[]>([]);
	let isLoading = $state(false);
	let showResults = $state(false);
	let searchTimeout: ReturnType<typeof setTimeout> | null = null;


	const searchGames = async (query: string) => {
		if (!query || query.trim().length < 3) {
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
  <h2 class="text-lg font-semibold text-base-content mb-4">Ajouter/Modifier un jeu sur la liste</h2>
  
  <div class="card bg-base-100 shadow-sm p-8 items-center justify-between gap-4 w-full">
    <div class="flex items-center justify-between gap-4 w-full">
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
          <kbd class="kbd kbd-sm px-2">ctrl</kbd>
          <kbd class="kbd kbd-sm">K</kbd>
        </label>
        
        {#if showResults}
          <div class="absolute top-full left-0 right-0 z-50 mt-2 bg-base-100 border border-base-300 rounded-lg shadow-lg max-h-96 overflow-y-auto">
            {#if isLoading}
              <div class="p-4 text-center">
                <span class="loading loading-spinner loading-sm"></span>
                <span class="ml-2">Recherche en cours...</span>
              </div>
            {:else if searchResults.length === 0}
              <div class="p-4 text-center text-base-content/60">
                Aucun jeu trouvé
              </div>
            {:else}
              {#each searchResults as game}
                <a href="/dashboard/game/{game.id}" class="block p-4 border-b border-base-300 last:border-b-0 hover:bg-base-200 cursor-pointer">
                  <div class="flex items-start gap-3">
                    <img 
                      src={game.image} 
                      alt={game.name}
                      class="w-12 h-12 object-cover rounded"
                      loading="lazy"
                    />
                    <div class="flex-1 min-w-0">
                      <h3 class="font-semibold text-base truncate">{game.name}</h3>
                      <p class="text-sm text-base-content/70 truncate">{game.description || 'Aucune description'}</p>
                      <div class="flex items-center gap-2 mt-1">
                        <span class="badge badge-sm badge-outline">{game.type}</span>
                        {#if game.tags}
                          <span class="text-xs text-base-content/60 truncate">{game.tags}</span>
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
