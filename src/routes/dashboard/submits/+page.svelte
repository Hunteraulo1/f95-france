<script lang="ts">
	import SubmissionsListPage from '$lib/components/dashboard/submissions/SubmissionsListPage.svelte';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();
</script>

<SubmissionsListPage
	title="Soumissions"
	basePath="/dashboard/submits"
	{data}
	canEditStatus={true}
	reviewMode
/>
