<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import AbandonTranslationModal from '$lib/components/dashboard/AbandonTranslationModal.svelte';
	import FixedDropdownMenu from '$lib/components/dashboard/FixedDropdownMenu.svelte';
	import ResumeTranslationModal from '$lib/components/dashboard/ResumeTranslationModal.svelte';
	import Pagination from '$lib/components/Pagination.svelte';
	import { createFormEnhance } from '$lib/forms/enhance';
	import { newToast } from '$lib/stores';
	import EllipsisVertical from '@lucide/svelte/icons/ellipsis-vertical';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import Search from '@lucide/svelte/icons/search';
	import X from '@lucide/svelte/icons/x';
	import { untrack } from 'svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let searchQuery = $state('');
	let searchTimer: ReturnType<typeof setTimeout> | null = null;
	let abandonTarget = $state<(typeof data.translations)[number] | null>(null);
	let resumeTarget = $state<(typeof data.translations)[number] | null>(null);
	let abandoning = $state(false);
	let resuming = $state(false);
	let abandonForm = $state<HTMLFormElement | undefined>(undefined);
	let resumeForm = $state<HTMLFormElement | undefined>(undefined);

	const roleOptions = [
		{ value: 'all', label: 'Toutes' },
		{ value: 'translator', label: 'Traductions' },
		{ value: 'proofreader', label: 'Relectures' }
	] as const;

	const statusOptions = [
		{ value: 'all', label: 'Toutes' },
		{ value: 'in_progress', label: 'En cours' },
		{ value: 'completed', label: 'Terminées' },
		{ value: 'abandoned', label: 'Abandonnées' }
	] as const;

	const buildQuery = (overrides: { status?: string; role?: string; q?: string; page?: number }) => {
		const status = overrides.status ?? data.statusFilter;
		const role = overrides.role ?? data.roleFilter;
		const q = overrides.q ?? data.q ?? '';
		const page = overrides.page ?? 1;
		const params = [
			`status=${encodeURIComponent(status)}`,
			`role=${encodeURIComponent(role)}`,
			...(q ? [`q=${encodeURIComponent(q)}`] : []),
			...(page > 1 ? [`page=${page}`] : [])
		];
		return params.length ? `?${params.join('&')}` : '';
	};

	const buildHref = (overrides: { status?: string; role?: string; q?: string; page?: number }) =>
		resolve(`/dashboard/my-translations${buildQuery(overrides)}` as '/dashboard/my-translations');

	const navigateSearch = (value: string) => {
		goto(
			resolve(
				`/dashboard/my-translations${buildQuery({ q: value, page: 1 })}` as '/dashboard/my-translations'
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

	const labelStatus = (s: string) => {
		if (s === 'completed') return 'Terminé';
		if (s === 'abandoned') return 'Abandonné';
		return 'En cours';
	};

	const statusBadge = (s: string) => {
		if (s === 'completed') return 'badge-success';
		if (s === 'abandoned') return 'badge-error';
		return 'badge-warning';
	};

	const tnameLabels: Record<string, string> = {
		no_translation: 'Pas de traduction',
		integrated: 'Intégrée',
		translation: 'Traduction',
		translation_with_mods: 'Traduction (avec mods)'
	};

	const ttypeLabels: Record<string, string> = {
		vf: 'VO Française',
		manual: 'Relecture complète',
		'semi-auto': 'Relecture partielle',
		auto: 'Traduction automatique',
		to_tested: 'À tester',
		hs: 'Lien HS'
	};

	const labelTname = (s: string | null | undefined) => (s ? (tnameLabels[s] ?? s) : '—');
	const labelTtype = (s: string | null | undefined) => (s ? (ttypeLabels[s] ?? s) : '—');

	const staff = (id: string | null) => {
		if (!id) return null;
		return data.staffById?.[id] ?? { name: id, username: null };
	};

	const openAbandonModal = (t: (typeof data.translations)[number]) => {
		abandonTarget = t;
	};

	const closeAbandonModal = () => {
		if (abandoning) return;
		abandonTarget = null;
	};

	const openResumeModal = (t: (typeof data.translations)[number]) => {
		resumeTarget = t;
	};

	const closeResumeModal = () => {
		if (resuming) return;
		resumeTarget = null;
	};

	const confirmAbandonTranslation = () => {
		abandonForm?.requestSubmit();
	};

	const confirmResumeTranslation = () => {
		resumeForm?.requestSubmit();
	};

	const abandonTranslationEnhance = createFormEnhance({
		updateOnlyOnSuccess: true,
		invalidateAll: true,
		onStart: () => {
			abandoning = true;
		},
		onFailure: (message) => {
			abandoning = false;
			newToast({ alertType: 'error', message });
		},
		onSuccess: (result) => {
			abandoning = false;
			abandonTarget = null;
			const message =
				(result.data as { message?: string } | undefined)?.message ??
				'Traduction abandonnée pour vous.';
			newToast({ alertType: 'success', message });
		}
	});

	const resumeTranslationEnhance = createFormEnhance({
		updateOnlyOnSuccess: true,
		invalidateAll: true,
		onStart: () => {
			resuming = true;
		},
		onFailure: (message) => {
			resuming = false;
			newToast({ alertType: 'error', message });
		},
		onSuccess: (result) => {
			resuming = false;
			resumeTarget = null;
			const message =
				(result.data as { message?: string } | undefined)?.message ??
				'Suivi de la traduction repris.';
			newToast({ alertType: 'success', message });
		}
	});

	const rowHasMenuActions = (t: (typeof data.translations)[number]) =>
		Boolean(
			(t.tlink && t.tlink.trim()) || t.canMuteTranslatorAlerts || t.canResumeTranslatorAlerts
		);
</script>

<div class="space-y-6">
	<div class="flex flex-wrap items-end justify-between gap-4">
		<div>
			<h1 class="text-3xl font-bold text-base-content">Mes traductions</h1>
			<p class="mt-1 text-sm text-base-content/70">
				{#if data.linkedTranslator}
					Filtré sur <strong>{data.linkedTranslator.name}</strong>
					{#if data.outdatedCount > 0}
						<span class="ml-2 badge badge-sm badge-warning">
							{data.outdatedCount} traduction(s) plus à jour
						</span>
					{/if}
				{:else}
					Aucun traducteur n’est lié à ton compte.
				{/if}
			</p>
		</div>

		{#if data.linkedTranslator}
			<div class="flex w-full flex-wrap justify-between">
				<label class="input input-sm w-full sm:w-64">
					<Search size={16} class="opacity-60" />
					<input
						type="search"
						placeholder="Rechercher un jeu…"
						value={searchQuery}
						oninput={(e) => onSearchInput(e.currentTarget.value)}
					/>
					{#if searchQuery}
						<button
							type="button"
							class="opacity-60 hover:opacity-100"
							aria-label="Effacer la recherche"
							onclick={clearSearch}
						>
							<X size={14} />
						</button>
					{/if}
				</label>
				<div class="flex gap-2">
					<div class="join rounded-sm border border-base-300 bg-base-100">
						{#each roleOptions as option (option.value)}
							<a
								class="btn join-item text-nowrap btn-sm {data.roleFilter === option.value
									? 'bg-base-300 btn-outline btn-primary'
									: 'btn-ghost'}"
								href={buildHref({ role: option.value })}
							>
								{option.label}
							</a>
						{/each}
					</div>
					<div class="join rounded-sm border border-base-300 bg-base-100">
						{#each statusOptions as option (option.value)}
							<a
								class="btn join-item text-nowrap btn-sm {data.statusFilter === option.value
									? 'bg-base-300 btn-outline btn-primary'
									: 'btn-ghost'}"
								href={buildHref({ status: option.value })}
							>
								{option.label}
							</a>
						{/each}
					</div>
				</div>
			</div>
		{/if}
	</div>

	{#if !data.linkedTranslator}
		<div role="alert" class="alert alert-warning">
			<div>
				<div class="font-semibold">Aucun lien traducteur</div>
				<div class="text-sm opacity-80">
					Demande à un admin de lier ton compte à ton entrée « Traducteur/Relecteur ».
				</div>
			</div>
			<a class="btn btn-outline btn-sm" href="/dashboard/settings">Paramètres</a>
		</div>
	{:else if data.totalCount === 0}
		<div class="card bg-base-100 shadow">
			<div class="card-body">
				{#if data.q}
					<h2 class="card-title">Aucun résultat</h2>
					<p class="text-base-content/70">
						Aucune traduction ne correspond à « <strong>{data.q}</strong> ».
					</p>
					<div class="card-actions">
						<button class="btn btn-outline btn-sm" onclick={clearSearch}>
							Effacer la recherche
						</button>
					</div>
				{:else}
					<h2 class="card-title">Aucune traduction trouvée</h2>
					<p class="text-base-content/70">
						Sur ces filtres, aucune ligne ne correspond à ton rôle (traducteur / relecteur).
					</p>
				{/if}
			</div>
		</div>
	{:else}
		<div class="overflow-x-auto rounded-box border border-base-300 bg-base-100">
			<table class="table">
				<thead>
					<tr>
						<th>Jeu</th>
						<th>Traduction</th>
						<th>Mise à jour</th>
						<th>Statut traduction</th>
						<th>Versions</th>
						<th>Rôle</th>
						<th class="text-right">Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each data.translations as t (t.id)}
						<tr>
							<td class="font-semibold">
								<a class="link link-hover" href={`/dashboard/game/${t.game.id}`}>{t.game.name}</a>
							</td>
							<td>
								<div class="flex flex-col">
									<span>{t.translationName || '—'}</span>
									<span class="text-xs opacity-70">
										{labelTname(t.tname)}
										{#if t.tname && t.tname !== 'no_translation' && t.ttype}
											· {labelTtype(t.ttype)}
										{/if}
									</span>
								</div>
							</td>
							<td class="text-center text-nowrap">
								{#if t.isFollowAbandoned}
									<span class="badge badge-sm badge-error">Abandonnée</span>
								{:else if t.isOutdated}
									<span class="badge badge-sm badge-warning">Pas à jour</span>
								{:else}
									<span class="badge badge-sm badge-success">À jour</span>
								{/if}
							</td>
							<td class="text-center text-nowrap">
								<span class={`badge badge-sm ${statusBadge(t.status)}`}
									>{labelStatus(t.status)}</span
								>
							</td>
							<td
								class="max-w-40 overflow-hidden text-sm text-nowrap text-ellipsis hover:overflow-visible"
							>
								<div class="flex flex-col">
									<span>Ref: {t.referenceVersion || '—'}</span>
									<span>Trad: {t.tversion || '—'}</span>
									<span class="text-xs opacity-70">Jeu: {t.game.gameVersion || '—'}</span>
								</div>
							</td>
							<td class="text-sm">
								{#if t.translatorId === data.linkedTranslator.id}
									{@const proofreader = staff(t.proofreaderId)}
									<div class="text-nowrap">Mon rôle : Traducteur</div>
									<div class="text-xs opacity-70">
										Relecteur :
										{#if proofreader?.username}
											<a
												class="link link-hover"
												href={`/dashboard/profile/${proofreader.username}`}
											>
												{proofreader.name}
											</a>
										{:else}
											{proofreader?.name ?? '—'}
										{/if}
									</div>
								{:else}
									{@const translator = staff(t.translatorId)}
									<div>Mon rôle : Relecteur</div>
									<div class="text-xs opacity-70">
										Traducteur :
										{#if translator?.username}
											<a class="link link-hover" href={`/dashboard/profile/${translator.username}`}>
												{translator.name}
											</a>
										{:else}
											{translator?.name ?? '—'}
										{/if}
									</div>
								{/if}
							</td>
							<td class="text-right">
								{#if rowHasMenuActions(t)}
									<FixedDropdownMenu label="Actions pour {t.game.name}">
										{#snippet trigger()}
											<EllipsisVertical size={18} />
										{/snippet}
										{#if t.tlink && t.tlink.trim().length > 0}
											<li>
												<a
													href={t.tlink}
													target="_blank"
													rel="noopener noreferrer"
													class="flex items-center gap-2"
												>
													<ExternalLink size={16} />
													Ouvrir le lien de téléchargement
												</a>
											</li>
										{/if}
										{#if t.canResumeTranslatorAlerts}
											<li>
												<button
													type="button"
													class="text-primary"
													onclick={() => openResumeModal(t)}
												>
													Reprendre la traduction
												</button>
											</li>
										{/if}
										{#if t.canMuteTranslatorAlerts}
											<li>
												<button
													type="button"
													class="text-error"
													onclick={() => openAbandonModal(t)}
												>
													Abandonner la traduction
												</button>
											</li>
										{/if}
									</FixedDropdownMenu>
								{:else}
									<span class="text-sm opacity-60">—</span>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<Pagination
			currentPage={data.page}
			totalPages={data.totalPages}
			totalCount={data.totalCount}
			hrefForPage={(p) => buildHref({ page: p })}
		/>
	{/if}
</div>

{#if abandonTarget}
	<form
		bind:this={abandonForm}
		method="POST"
		action="?/abandonTranslation"
		use:enhance={abandonTranslationEnhance}
		class="hidden"
		aria-hidden="true"
	>
		<input type="hidden" name="translationId" value={abandonTarget.id} />
	</form>
	<AbandonTranslationModal
		gameName={abandonTarget.game.name}
		translationName={abandonTarget.translationName}
		confirming={abandoning}
		onClose={closeAbandonModal}
		onConfirm={confirmAbandonTranslation}
	/>
{/if}

{#if resumeTarget}
	<form
		bind:this={resumeForm}
		method="POST"
		action="?/resumeTranslation"
		use:enhance={resumeTranslationEnhance}
		class="hidden"
		aria-hidden="true"
	>
		<input type="hidden" name="translationId" value={resumeTarget.id} />
	</form>
	<ResumeTranslationModal
		gameName={resumeTarget.game.name}
		translationName={resumeTarget.translationName}
		confirming={resuming}
		onClose={closeResumeModal}
		onConfirm={confirmResumeTranslation}
	/>
{/if}
