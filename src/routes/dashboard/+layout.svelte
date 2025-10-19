<script lang="ts">
	import Header from '$lib/components/dashboard/Header.svelte';
	import Sidebar from '$lib/components/dashboard/Sidebar.svelte';
	import type { User } from '$lib/types/data';

	let { children } = $props();

  let isSidebarOpen: boolean = $state(true);

  const user = $state<User>({ id: '1', username: 'John Doe', role: 'superadmin' }); // TODO: Get user from database
</script>

<Header bind:isSidebarOpen />

<main class="drawer drawer-open overflow-hidden max-h-[calc(100vh-4rem)]">  
  <div class="drawer-content bg-base-200 p-16 overflow-y-auto">
    {@render children?.()}
  </div>
  <Sidebar bind:isSidebarOpen {user} />
</main>
