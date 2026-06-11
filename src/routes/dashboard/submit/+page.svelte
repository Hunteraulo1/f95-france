<script lang="ts">
	import SubmissionsListPage from '$lib/components/dashboard/submissions/SubmissionsListPage.svelte';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();
</script>

<SubmissionsListPage
	title="Mes soumissions"
	basePath="/dashboard/submit"
	{data}
	canEditStatus={false}
/>
