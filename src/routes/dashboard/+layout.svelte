<script>
	import '../../app.css';
	import Header from '$lib/components/dashboard/Header.svelte';
	import Sidebar from '$lib/components/dashboard/Sidebar.svelte';
	import Toaster from '$lib/components/Toaster.svelte';
	import { initializeUserFromLocals, setRoleBadgeStyles, setUserPermissions } from '$lib/stores';

	let { children, data } = $props();

	$effect(() => {
		initializeUserFromLocals(data?.user);
		setUserPermissions(data?.permissions ?? []);
		setRoleBadgeStyles(data?.roleBadgeStyles ?? {});
	});
</script>

<svelte:head>
	<title>F95 France - Dashboard</title>
</svelte:head>

<Header maintenanceMode={data.maintenanceMode} />

<main
	class="drawer h-[calc(100vh-4rem)] overflow-hidden sm:drawer-open bg-base-200 overflow-y-auto"
>
	<div class="drawer-content p-4 sm:p-8 lg:p-16 max-w-[1536px] w-full mx-auto">
		{@render children?.()}
	</div>
	{#if data.user}
		<Sidebar
			pendingSubmissionsCount={data.pendingSubmissionsCount}
			hasLinkedTranslator={data.hasLinkedTranslator}
			canReturnToOwnAccount={data.canReturnToOwnAccount}
			devOriginUsername={data.devOriginUsername}
		/>
	{/if}
</main>

<!-- Toasts -->
<div class="toast toast-end toast-top z-9999">
	<Toaster />
</div>
