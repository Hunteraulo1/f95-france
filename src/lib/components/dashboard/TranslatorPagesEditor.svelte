<script lang="ts">
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import ChevronUp from '@lucide/svelte/icons/chevron-up';

	export type TranslatorPageRow = { name: string; link: string };

	let {
		pages = $bindable([] as TranslatorPageRow[]),
		pageNameField,
		pageLinkField,
		minRows = 1,
		showHelper = true
	}: {
		pages?: TranslatorPageRow[];
		pageNameField?: string;
		pageLinkField?: string;
		/** Nombre minimum de lignes (souvent 1 à la création, 0 pour autoriser une liste vide). */
		minRows?: number;
		showHelper?: boolean;
	} = $props();

	const movePage = (index: number, direction: -1 | 1) => {
		const target = index + direction;
		if (target < 0 || target >= pages.length) return;
		const next = [...pages];
		[next[index], next[target]] = [next[target], next[index]];
		pages = next;
	};

	const removePage = (index: number) => {
		if (pages.length <= minRows) return;
		pages = pages.filter((_, i) => i !== index);
	};

	const addPage = () => {
		pages = [...pages, { name: '', link: '' }];
	};
</script>

{#if showHelper}
	<p class="text-sm text-base-content/70 mb-2">
		Le <span class="font-medium text-primary">premier lien</span> est le lien principal du traducteur
		(fiches jeu, API, Google Sheet). Utilisez les flèches pour changer l’ordre.
	</p>
{/if}

<div class="space-y-3">
	{#each pages as page, index (index)}
		<div
			class="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center {index === 0
				? 'border-primary/50 bg-primary/5'
				: 'border-base-300'}"
		>
			<div class="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
				{#if index === 0}
					<span class="badge badge-primary badge-sm shrink-0 self-start sm:self-center"
						>Lien principal</span
					>
				{/if}
				<input
					type="text"
					placeholder="Nom de la page"
					class="input-bordered input min-w-0 flex-1"
					bind:value={page.name}
					name={pageNameField}
				/>
				<input
					type="url"
					placeholder="https://…"
					class="input-bordered input min-w-0 flex-1"
					bind:value={page.link}
					name={pageLinkField}
				/>
			</div>
			<div class="flex shrink-0 items-center justify-end gap-1">
				<button
					type="button"
					class="btn btn-square btn-ghost btn-sm"
					disabled={index === 0}
					onclick={() => movePage(index, -1)}
					aria-label="Monter cette page"
				>
					<ChevronUp class="size-4" />
				</button>
				<button
					type="button"
					class="btn btn-square btn-ghost btn-sm"
					disabled={index === pages.length - 1}
					onclick={() => movePage(index, 1)}
					aria-label="Descendre cette page"
				>
					<ChevronDown class="size-4" />
				</button>
				<button
					type="button"
					class="btn btn-square btn-ghost btn-sm text-error"
					disabled={pages.length <= minRows}
					onclick={() => removePage(index)}
					aria-label="Supprimer cette page"
				>
					✕
				</button>
			</div>
		</div>
	{:else}
		<p class="text-sm text-base-content/60">
			Aucune page (la liste sera vide après enregistrement).
		</p>
	{/each}
</div>

<button type="button" class="btn btn-outline btn-sm mt-2" onclick={addPage}
	>+ Ajouter une page</button
>
