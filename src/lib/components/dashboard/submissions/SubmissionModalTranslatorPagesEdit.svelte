<script lang="ts">
	type TranslatorPageRow = { name: string; link: string };

	let {
		pages = $bindable([] as TranslatorPageRow[]),
		onAdd,
		onRemove
	}: {
		pages?: TranslatorPageRow[];
		onAdd: () => void;
		onRemove: (index: number) => void;
	} = $props();
</script>

<div class="mt-2 space-y-4">
	<h5 class="text-md font-semibold">Pages traducteur</h5>
	<div class="space-y-2">
		{#each pages as page, index (index)}
			<div class="flex items-center gap-2">
				<input
					type="text"
					class="input-bordered input flex-1"
					placeholder="Nom de la page"
					name="editTranslatorPageName"
					bind:value={page.name}
				/>
				<input
					type="url"
					class="input-bordered input flex-1"
					placeholder="Lien"
					name="editTranslatorPageLink"
					bind:value={page.link}
				/>
				<button type="button" class="btn btn-sm btn-error" onclick={() => onRemove(index)}>
					✕
				</button>
			</div>
		{/each}
		{#if pages.length === 0}
			<div class="text-sm opacity-70">Aucune page (la liste sera vide après enregistrement).</div>
		{/if}
	</div>
	<button type="button" class="btn btn-outline btn-sm" onclick={onAdd}>+ Ajouter une ligne</button>
</div>
