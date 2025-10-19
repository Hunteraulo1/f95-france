<script lang="ts">
	import { Search } from '@lucide/svelte';

</script>

<h2 class="text-lg font-semibold text-slate-900 dark:text-slate-200 mb-4">Ajouter/Modifier un jeu sur la liste</h2>

<div class="card bg-base-100 shadow-sm p-8 items-center justify-between gap-4 w-full">
  <div class="flex items-center justify-between gap-4 w-full">
    <label class="input w-full flex">
      <Search size={20} class="min-w-5" />
      <input type="search" class="grow ring-0" placeholder="Rechercher un jeu dans la liste" />
      <kbd class="kbd kbd-sm px-2">ctrl</kbd>
      <kbd class="kbd kbd-sm">K</kbd>
    </label>
    <button class="btn btn-primary">AJOUTER UN JEU</button>
  </div>
</div>
