<script lang="ts">
	import Header from '$lib/components/dashboard/Header.svelte';
	import Sidebar from '$lib/components/dashboard/Sidebar.svelte';
	import Toaster from '$lib/components/Toaster.svelte';
	import { initializeUserFromLocals } from '$lib/stores';
	import { type Snippet } from 'svelte';
	import type { LayoutServerData } from './$types';

  interface Props {
    children: Snippet
    data: LayoutServerData
  }

	let { children, data }: Props = $props();

  let isSidebarOpen: boolean = $state(true);
  
	$effect(() => {
		initializeUserFromLocals(data?.user);
	});
</script>

<Header bind:isSidebarOpen />

<main class="drawer drawer-open overflow-hidden max-h-[calc(100vh-4rem)]">  
  <div class="drawer-content bg-base-200 p-16 overflow-y-auto max-h-[calc(100vh-4rem)]">
    {@render children?.()}
  </div>
  <Sidebar bind:isSidebarOpen />
</main>

<!-- Toasts -->
<div class="toast toast-top toast-end">
  <Toaster />
</div>
