<script lang="ts">
	import Header from '$lib/components/dashboard/Header.svelte';
	import Sidebar from '$lib/components/dashboard/Sidebar.svelte';
	import Toaster from '$lib/components/Toaster.svelte';
	import { syncSessionFromLayoutData } from '$lib/stores';
	import '../../app.css';

	let { children, data } = $props();

	$effect(() => {
		syncSessionFromLayoutData(data);
	});
</script>

<svelte:head>
	<title>F95 France - Dashboard</title>
</svelte:head>

<Header maintenanceMode={data.maintenanceMode} />

<main
	class="drawer h-[calc(100vh-4rem)] overflow-hidden overflow-y-auto bg-base-200 sm:drawer-open"
>
	<div class="drawer-content mx-auto w-full max-w-[1536px] p-4 sm:p-8 lg:p-16">
		{@render children?.()}
	</div>
	{#if data.user}
		<Sidebar
			pendingSubmissionsCount={data.pendingSubmissionsCount}
			pendingTranslatorApplicationsCount={data.pendingTranslatorApplicationsCount}
			hasLinkedTranslator={data.hasLinkedTranslator}
			canReturnToOwnAccount={data.canReturnToOwnAccount}
			devOriginUsername={data.devOriginUsername}
			permissions={data.permissions}
			userRole={data.user.role}
			hasUser={true}
		/>
	{/if}
</main>

<!-- Toasts -->
<div class="toast toast-end toast-top z-9999">
	<Toaster />
</div>
