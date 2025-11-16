<script lang="ts">
	import Header from '$lib/components/dashboard/Header.svelte';
	import Sidebar from '$lib/components/dashboard/Sidebar.svelte';
	import Toaster from '$lib/components/Toaster.svelte';
	import { initializeUserFromLocals } from '$lib/stores';
	import { type Snippet } from 'svelte';
	import type { LayoutServerData } from './$types';

	interface Props {
		children: Snippet;
		data: LayoutServerData;
	}

	let { children, data }: Props = $props();

	let isSidebarOpen: boolean = $state(true);

	$effect(() => {
		initializeUserFromLocals(data?.user);
	});
</script>

<Header bind:isSidebarOpen />

<main class="drawer-open drawer max-h-[calc(100vh-4rem)] overflow-hidden">
	<div class="drawer-content max-h-[calc(100vh-4rem)] overflow-y-auto bg-base-200 p-16">
		{@render children?.()}
	</div>
	<Sidebar bind:isSidebarOpen pendingSubmissionsCount={data.pendingSubmissionsCount} />
</main>

<!-- Toasts -->
<div class="toast toast-end toast-top">
	<Toaster />
</div>
