<script lang="ts">
	import LegalDocumentPage from '$lib/components/LegalDocumentPage.svelte';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();
</script>

<LegalDocumentPage
	title={data.title}
	description={data.description}
	blocks={data.blocks}
	updatedAt={data.updatedAt}
	sourceUrl={data.sourceUrl}
/>
