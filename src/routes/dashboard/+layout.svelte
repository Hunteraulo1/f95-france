<script lang="ts">
	import Header from '$lib/components/dashboard/Header.svelte';
	import Sidebar from '$lib/components/dashboard/Sidebar.svelte';
	import { loadUserData } from '$lib/stores';
	import { onMount, type Snippet } from 'svelte';
	import type { PageServerData } from './$types';

  interface Props {
    children: Snippet
    data: PageServerData
  }

	let { children, data }: Props = $props();

  let isSidebarOpen: boolean = $state(true);

	// Charger les données utilisateur au montage du composant
	onMount(async () => {
		if (data.user?.id) {
			await loadUserData(data.user.id);
		}
	});
</script>

<Header bind:isSidebarOpen />

<main class="drawer drawer-open overflow-hidden max-h-[calc(100vh-4rem)]">  
  <div class="drawer-content bg-base-200 p-16 overflow-y-auto">
    {@render children?.()}
  </div>
  <Sidebar bind:isSidebarOpen />
</main>
