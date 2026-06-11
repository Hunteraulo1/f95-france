<script lang="ts">
	import TranslatorPagesEditor, {
		type TranslatorPageRow
	} from '$lib/components/dashboard/TranslatorPagesEditor.svelte';

	let { pages = $bindable([] as TranslatorPageRow[]) }: { pages?: TranslatorPageRow[] } = $props();
</script>

<div class="mt-2 space-y-3">
	<h5 class="text-md font-semibold">Pages traducteur</h5>
	<TranslatorPagesEditor
		bind:pages
		minRows={0}
		pageNameField="editTranslatorPageName"
		pageLinkField="editTranslatorPageLink"
	/>
</div>
