<script>
	import Header from '$lib/components/dashboard/Header.svelte';
	import Sidebar from '$lib/components/dashboard/Sidebar.svelte';
	import Toaster from '$lib/components/Toaster.svelte';
	import { initializeUserFromLocals } from '$lib/stores';

	let { children, data } = $props();

	$effect(() => {
		initializeUserFromLocals(data?.user);
	});
</script>

<Header />

<main class="drawer h-[calc(100vh-4rem)] overflow-hidden sm:drawer-open">
	<div class="drawer-content mb-12 overflow-y-auto bg-base-200 p-4 sm:p-8 lg:p-16">
		{@render children?.()}
	</div>
	<Sidebar pendingSubmissionsCount={data.pendingSubmissionsCount} />
</main>

<div class="toast toast-end toast-top">
	<Toaster />
</div>
