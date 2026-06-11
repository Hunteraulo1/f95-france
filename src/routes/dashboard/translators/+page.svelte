<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import DaisyDashboardModal from '$lib/components/dashboard/DaisyDashboardModal.svelte';
	import TranslatorPagesEditor from '$lib/components/dashboard/TranslatorPagesEditor.svelte';
	import Pagination from '$lib/components/Pagination.svelte';
	import { createFormEnhance } from '$lib/forms/enhance';
	import { formatUserAccountOptionLabel } from '$lib/permissions/user-email';
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
			<button
				type="button"
				class="btn btn-square btn-ghost btn-sm"
				onclick={clearSearch}
				aria-label="Effacer la recherche"
			>
				✕
			</button>
		{/if}
	</label>
	{#if data.canManageTranslators}
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
						{#if data.canManageTranslators || translator.userId === data.currentUserId}
							<button
								class="btn btn-sm btn-primary"
								onclick={() => {
									selectedTranslator = translator;
									initializePagesForEdit(translator);
									showEditModal = true;
								}}
							>
								{data.canManageTranslators ? 'Modifier' : 'Proposer pages'}
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

{#if data.canManageTranslators && showAddModal}
	<DaisyDashboardModal
		open={showAddModal}
		title="Ajouter un traducteur"
		onClose={() => (showAddModal = false)}
	>
		{#if addError}
			<div class="mb-4 alert alert-error">
				<span>{addError}</span>
			</div>
		{/if}
		<form
			id="add-translator-form"
			method="POST"
			action="?/addTranslator"
			use:enhance={createFormEnhance({
				onStart: () => {
					addError = null;
				},
				onFailure: (message) => {
					addError = message;
				},
				onSuccess: () => {
					showAddModal = false;
					pages = [{ name: '', link: '' }];
				}
			})}
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
						<option value={u.id}
							>{formatUserAccountOptionLabel(u.username, u.email, data.canViewUserEmails)}</option
						>
					{/each}
				</select>
			</div>
			<div class="form-control w-full">
				<label class="label" for="pages">
					<span class="label-text">Pages traducteur</span>
				</label>
				<TranslatorPagesEditor bind:pages />
				<input
					type="hidden"
					name="pages"
					value={JSON.stringify(pages.filter((page) => page.name !== '' || page.link !== ''))}
				/>
			</div>
		</form>
		{#snippet footer()}
			<button type="button" class="btn" onclick={() => (showAddModal = false)}>Annuler</button>
			<button type="submit" form="add-translator-form" class="btn btn-primary">Ajouter</button>
		{/snippet}
	</DaisyDashboardModal>
{/if}

{#if showEditModal && selectedTranslator}
	<DaisyDashboardModal
		open={showEditModal}
		title="Modifier le traducteur"
		onClose={() => (showEditModal = false)}
	>
		{#if selectedTranslator}
			{#if editError}
				<div class="mb-4 alert alert-error">
					<span>{editError}</span>
				</div>
			{/if}
			<form
				id="edit-translator-form"
				method="POST"
				action={data.canManageTranslators ? '?/editTranslator' : '?/requestTranslatorPagesUpdate'}
				use:enhance={createFormEnhance({
					onStart: () => {
						editError = null;
					},
					onFailure: (message) => {
						editError = message;
					},
					onSuccess: () => {
						handleEditSuccess();
					}
				})}
			>
				<input type="hidden" name="id" value={selectedTranslator.id} />
				{#if data.canManageTranslators}
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
									{formatUserAccountOptionLabel(u.username, u.email, data.canViewUserEmails)}
								</option>
							{/each}
						</select>
					</div>
				{:else}
					<input type="hidden" name="translatorId" value={selectedTranslator.id} />
					<p class="mb-2 text-sm opacity-80">
						{#if data.translatorPagesWriteMode === 'direct'}
							Les modifications des pages sont appliquées immédiatement.
						{:else}
							La modification des pages sera soumise à validation admin.
						{/if}
					</p>
					{#if data.roleEditMode === 'user_direct_mode'}
						<input type="hidden" name="directMode" value={data.directMode ? 'true' : 'false'} />
					{/if}
				{/if}
				<div class="form-control w-full">
					<label class="label" for="pages">
						<span class="label-text">Pages traducteur</span>
					</label>
					<TranslatorPagesEditor bind:pages />
					<input
						type="hidden"
						name="pages"
						value={JSON.stringify(pages.filter((page) => page.name !== '' || page.link !== ''))}
					/>
				</div>
			</form>
		{/if}
		{#snippet footer()}
			<button type="button" class="btn" onclick={() => (showEditModal = false)}>Annuler</button>
			<button type="submit" form="edit-translator-form" class="btn btn-primary">
				{data.canManageTranslators ? 'Modifier' : 'Soumettre'}
			</button>
		{/snippet}
	</DaisyDashboardModal>
{/if}
