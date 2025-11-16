<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	let searchQuery = $state('');

	let filteredTranslators = $derived.by(() =>
		data.translator.filter(
			(traductor) =>
				traductor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
				(traductor.discordId && traductor.discordId.toString().includes(searchQuery))
		)
	);

	let showAddModal = $state(false);
	let showEditModal = $state(false);
	let selectedTranslator: (typeof data.translator)[number] | null = $state(null);

	let pages = $state([{ name: '', link: '' }]);

	let addError = $state<string | null>(null);
	let editError = $state<string | null>(null);

	const addPage = () => {
		pages = [...pages, { name: '', link: '' }];
	};

	const removePage = (index: number) => {
		if (pages.length > 1) {
			pages = pages.filter((_, i) => i !== index);
		}
	};

	const initializePagesForEdit = (traductor: (typeof data.translator)[number]) => {
		if (traductor.pages && Array.isArray(traductor.pages)) {
			pages = traductor.pages.length > 0 ? traductor.pages : [{ name: '', link: '' }];
		} else {
			pages = [{ name: '', link: '' }];
		}
	};

	const handleEditSuccess = () => {
		showEditModal = false;
		selectedTranslator = null;
	};
</script>

<div class="flex w-full justify-end gap-2">
	<input
		type="text"
		class="input-bordered input"
		placeholder="Rechercher un traducteur"
		bind:value={searchQuery}
	/>
	<button class="btn btn-primary" onclick={() => (showAddModal = true)}>
		Ajouter un traducteur
	</button>
</div>

<div class="overflow-x-auto">
	<table class="table">
		<!-- head -->
		<thead>
			<tr>
				<th></th>
				<th>Traducteurs/Relecteurs</th>
				<th>ID Discord</th>
				<th>Pages</th>
				<th>Action</th>
			</tr>
		</thead>
		<tbody>
			{#each filteredTranslators as translator, index (translator.id)}
				{@const handleTranslatorClick = async () => {
					if (translator.userId) {
						// eslint-disable-next-line svelte/no-navigation-without-resolve
						await goto(`/dashboard/profile/${translator.userId}`, { invalidateAll: true });
					}
				}}
				<tr>
					<td class="font-bold">{index + 1}</td>
					<th
						class="font-bold"
						class:cursor-pointer={translator.userId}
						class:hover:text-primary={translator.userId}
						onclick={handleTranslatorClick}>{translator.name}</th
					>
					{#if translator.discordId}
						<td>
							{translator.discordId}
						</td>
					{:else}
						<td class="text-gray-500"> N/A </td>
					{/if}
					<td>
						{#each translator.pages as { name, link } (name + link)}
							<a href={link} target="_blank" class="mr-2 badge badge-outline hover:text-primary"
								>{name}</a
							>
						{:else}
							<p class="text-gray-500">N/A</p>
						{/each}
					</td>
					<td>
						<button
							class="btn btn-sm btn-primary"
							onclick={() => {
								selectedTranslator = translator;
								initializePagesForEdit(translator);
								showEditModal = true;
							}}
						>
							Modifier
						</button>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<!-- Modal d'ajout de traducteur -->
{#if showAddModal}
	<div class="modal-open modal">
		<div class="modal-box">
			<h3 class="text-lg font-bold">Ajouter un traducteur</h3>
			{#if addError}
				<div class="mb-4 alert alert-error">
					<span>{addError}</span>
				</div>
			{/if}
			<form
				method="POST"
				action="?/addTranslator"
				use:enhance={() => {
					addError = null;
					return async ({ result, update }) => {
						if (result.type === 'success') {
							await update();
							showAddModal = false;
							pages = [{ name: '', link: '' }];
							addError = null;
						} else if (result.type === 'failure' && result.data) {
							const errorData = result.data as { message?: string };
							addError = errorData.message || "Erreur lors de l'ajout du traducteur";
						}
					};
				}}
			>
				<div class="form-control w-full">
					<label for="add-name" class="label">
						<span class="label-text">Nom du traducteur</span>
					</label>
					<input
						id="add-name"
						type="text"
						name="name"
						class="input-bordered input w-full"
						class:input-error={addError}
						required
					/>
				</div>
				<div class="form-control w-full">
					<label for="add-discord" class="label">
						<span class="label-text">ID Discord</span>
					</label>
					<input
						id="add-discord"
						type="number"
						name="discordId"
						class="input-bordered input w-full"
					/>
				</div>
				<div class="form-control w-full">
					<label class="label" for="pages">
						<span class="label-text">Pages</span>
					</label>
					<div class="space-y-2">
						{#each pages as page, index (index)}
							<div class="flex items-center gap-2">
								<input
									type="text"
									placeholder="Nom de la page"
									class="input-bordered input flex-1"
									bind:value={page.name}
								/>
								<input
									type="url"
									placeholder="Lien"
									class="input-bordered input flex-1"
									bind:value={page.link}
								/>
								{#if pages.length > 1}
									<button
										type="button"
										class="btn btn-sm btn-error"
										onclick={() => removePage(index)}
									>
										✕
									</button>
								{/if}
							</div>
						{:else}
							<p class="text-gray-500">N/A</p>
						{/each}
						<button type="button" class="btn btn-outline btn-sm" onclick={addPage}>
							+ Ajouter une page
						</button>
					</div>
					<input
						type="hidden"
						name="pages"
						value={JSON.stringify(pages.filter((page) => page.name !== '' || page.link !== ''))}
					/>
				</div>
				<div class="modal-action">
					<button type="button" class="btn" onclick={() => (showAddModal = false)}>
						Annuler
					</button>
					<button type="submit" class="btn btn-primary"> Ajouter </button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Modal d'édition de traducteur -->
{#if showEditModal && selectedTranslator}
	<div class="modal-open modal">
		<div class="modal-box">
			<h3 class="text-lg font-bold">Modifier le traducteur</h3>
			{#if editError}
				<div class="mb-4 alert alert-error">
					<span>{editError}</span>
				</div>
			{/if}
			<form
				method="POST"
				action="?/editTranslator"
				use:enhance={() => {
					editError = null;
					return async ({ result, update }) => {
						if (result.type === 'success') {
							await update();
							handleEditSuccess();
							editError = null;
						} else if (result.type === 'failure' && result.data) {
							const errorData = result.data as { message?: string };
							editError = errorData.message || 'Erreur lors de la modification du traducteur';
						}
					};
				}}
			>
				<input type="hidden" name="id" value={selectedTranslator.id} />
				<div class="form-control w-full">
					<label for="edit-name" class="label">
						<span class="label-text">Nom du traducteur</span>
					</label>
					<input
						id="edit-name"
						type="text"
						name="name"
						class="input-bordered input w-full"
						class:input-error={editError}
						value={selectedTranslator.name}
						required
					/>
				</div>
				<div class="form-control w-full">
					<label for="edit-discord" class="label">
						<span class="label-text">ID Discord</span>
					</label>
					<input
						id="edit-discord"
						type="number"
						name="discordId"
						class="input-bordered input w-full"
						value={selectedTranslator.discordId || ''}
					/>
				</div>
				<div class="form-control w-full">
					<label class="label" for="pages">
						<span class="label-text">Pages</span>
					</label>
					<div class="space-y-2">
						{#each pages as page, index (index)}
							<div class="flex items-center gap-2">
								<input
									type="text"
									placeholder="Nom de la page"
									class="input-bordered input flex-1"
									bind:value={page.name}
								/>
								<input
									type="url"
									placeholder="Lien"
									class="input-bordered input flex-1"
									bind:value={page.link}
								/>
								{#if pages.length > 1}
									<button
										type="button"
										class="btn btn-sm btn-error"
										onclick={() => removePage(index)}
									>
										✕
									</button>
								{/if}
							</div>
						{/each}
						<button type="button" class="btn btn-outline btn-sm" onclick={addPage}>
							+ Ajouter une page
						</button>
					</div>
					<input
						type="hidden"
						name="pages"
						value={JSON.stringify(pages.filter((page) => page.name !== '' || page.link !== ''))}
					/>
				</div>
				<div class="modal-action">
					<button type="button" class="btn" onclick={() => (showEditModal = false)}>
						Annuler
					</button>
					<button type="submit" class="btn btn-primary"> Modifier </button>
				</div>
			</form>
		</div>
	</div>
{/if}
