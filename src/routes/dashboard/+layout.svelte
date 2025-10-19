<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import type { User } from '$lib/types/data';

	let { children } = $props();

  let isSidebarOpen: boolean = $state(true);

  const user = $state<User>({ id: '1', username: 'John Doe', role: 'superadmin' }); // TODO: Get user from database
</script>

<Header bind:isSidebarOpen />

<main class="flex h-[calc(100vh-4rem)] max-h-[calc(100vh-4rem)] overflow-hidden dark:bg-slate-800">  
  <Sidebar bind:isSidebarOpen {user} />
  <div class="overflow-y-auto w-full p-4">{@render children?.()}</div>
</main>
