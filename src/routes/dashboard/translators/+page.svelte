<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Pagination from '$lib/components/Pagination.svelte';
	import { untrack } from 'svelte';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	let searchQuery = $state('');
	let searchTimer: ReturnType<typeof setTimeout> | null = null;

	const buildQuery = (overrides: { q?: string; page?: number }) => {
		const qVal = overrides.q !== undefined ? overrides.q : (data.q ?? '');
		const page = overrides.page ?? data.page;
		const params: string[] = [];
		if (qVal) params.push(`q=${encodeURIComponent(qVal)}`);
		if (page > 1) params.push(`page=${page}`);
		return params.length ? `?${params.join('&')}` : '';
	};

	const buildHref = (overrides: { q?: string; page?: number }) =>
		resolve(`/dashboard/translators${buildQuery(overrides)}` as '/dashboard/translators');

	const hrefForPage = (p: number) => buildHref({ page: p });

	const navigateSearch = (value: string) => {
		goto(
			resolve(
				`/dashboard/translators${buildQuery({ q: value, page: 1 })}` as '/dashboard/translators'
			),
			{
				replaceState: true,
				keepFocus: true,
				noScroll: true,
				invalidateAll: true
			}
		);
	};

	const onSearchInput = (value: string) => {
		searchQuery = value;
		if (searchTimer) clearTimeout(searchTimer);
		searchTimer = setTimeout(() => navigateSearch(value), 300);
	};

	const clearSearch = () => {
		if (searchTimer) clearTimeout(searchTimer);
		searchQuery = '';
		navigateSearch('');
	};

	$effect(() => {
		const incoming = data.q ?? '';
		untrack(() => {
			if (incoming !== searchQuery) {
				searchQuery = incoming;
			}
		});
	});

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

<div class="mb-4 flex w-full flex-wrap items-center justify-end gap-2">
	<label class="input flex max-w-md min-w-48 items-center gap-2">
		<span class="sr-only">Rechercher un traducteur</span>
		<input
			type="search"
			class="grow"
			placeholder="Rechercher (nom, ID Discord)…"
			value={searchQuery}
			oninput={(e) => onSearchInput(e.currentTarget.value)}
		/>
		{#if searchQuery}
			<button type="button" class="btn btn-ghost btn-sm btn-square" onclick={clearSearch} aria-label="Effacer la recherche">
				✕
			</button>
		{/if}
	</label>
	{#if data.isAdmin}
		<button class="btn btn-primary" onclick={() => (showAddModal = true)}>
			Ajouter un traducteur
		</button>
	{/if}
</div>

<div class="card w-full overflow-x-auto border border-base-300 bg-base-100 shadow-xl">
	<table class="table card-body gap-6 table-zebra table-sm sm:py-8">
		<!-- head -->
		<thead>
			<tr>
				<th></th>
				<th>Traducteurs/Relecteurs</th>
				<th>Compte utilisateur</th>
				<th>ID Discord</th>
				<th>Pages</th>
				<th>Action</th>
			</tr>
		</thead>
		<tbody>
			{#each data.translator as translator, index (translator.id)}
				<tr>
					<td class="font-bold">{(data.page - 1) * data.pageSize + index + 1}</td>
					<th class="font-bold">{translator.name}</th>
					<td>
						{#if translator.userId}
							<button
								type="button"
								class="link text-left font-medium link-primary"
								onclick={() => {
									const username = data.users.find((u) => u.id === translator.userId)?.username;
									if (username) {
										void goto(resolve(`/dashboard/profile/${username}`), { invalidateAll: true });
									}
								}}
							>
								{data.users.find((u) => u.id === translator.userId)?.username ?? translator.userId}
							</button>
						{:else}
							<span class="text-base-content/50">N/A</span>
						{/if}
					</td>
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
						{#if data.isAdmin || translator.userId === data.currentUserId}
							<button
								class="btn btn-sm btn-primary"
								onclick={() => {
									selectedTranslator = translator;
									initializePagesForEdit(translator);
									showEditModal = true;
								}}
							>
								{data.isAdmin ? 'Modifier' : 'Proposer pages'}
							</button>
						{/if}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>

	<div class="card-body pt-0">
		<Pagination
			currentPage={data.page}
			totalPages={data.totalPages}
			totalCount={data.totalCount}
			{hrefForPage}
			countLabel="traducteur"
		/>
	</div>
</div>

<!-- Modal d'ajout de traducteur -->
{#if data.isAdmin && showAddModal}
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
					return async function ({ result, update }) {
						if (result.type === 'success') {
							await update();
							showAddModal = false;
							pages = [{ name: '', link: '' }];
							addError = null;
						} else if (result.type === 'failure' && result.data) {
							const errorData = result.data;
							const message =
								typeof errorData === 'object' && errorData && 'message' in errorData
									? String(errorData.message)
									: "Erreur lors de l'ajout du traducteur";
							addError = message;
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
					<label for="add-user-link" class="label">
						<span class="label-text">Compte utilisateur lié</span>
					</label>
					<select id="add-user-link" name="userId" class="select-bordered select w-full">
						<option value="">Aucun</option>
						{#each data.users as u (u.id)}
							<option value={u.id}>{u.username} ({u.email})</option>
						{/each}
					</select>
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
				action={data.isAdmin ? '?/editTranslator' : '?/requestTranslatorPagesUpdate'}
				use:enhance={() => {
					editError = null;
					return async function ({ result, update }) {
						if (result.type === 'success') {
							await update();
							handleEditSuccess();
							editError = null;
						} else if (result.type === 'failure' && result.data) {
							const errorData = result.data;
							const message =
								typeof errorData === 'object' && errorData && 'message' in errorData
									? String(errorData.message)
									: 'Erreur lors de la modification du traducteur';
							editError = message;
						}
					};
				}}
			>
				<input type="hidden" name="id" value={selectedTranslator.id} />
				{#if data.isAdmin}
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
						<label for="edit-user-link" class="label">
							<span class="label-text">Compte utilisateur lié</span>
						</label>
						<select id="edit-user-link" name="userId" class="select-bordered select w-full">
							<option value="" selected={!selectedTranslator.userId}>Aucun</option>
							{#each data.users as u (u.id)}
								<option value={u.id} selected={selectedTranslator.userId === u.id}>
									{u.username} ({u.email})
								</option>
							{/each}
						</select>
					</div>
				{:else}
					<input type="hidden" name="translatorId" value={selectedTranslator.id} />
					<p class="mb-2 text-sm opacity-80">
						La modification des pages sera soumise à validation admin.
					</p>
				{/if}
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
					<button type="submit" class="btn btn-primary">
						{data.isAdmin ? 'Modifier' : 'Soumettre'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
