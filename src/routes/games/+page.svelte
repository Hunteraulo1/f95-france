<script lang="ts">
	import { resolve } from '$app/paths';
	import GamesFilterContent from '$lib/components/games/GamesFilterContent.svelte';
	import { GAMES_VIEW_MODE_KEY, type GamesListViewMode } from '$lib/games/games-filter-config';
	import {
		buildPublicGamesListSearchParams,
		hasActivePublicGamesListFilters,
		type PublicGamesListParams
	} from '$lib/games/games-filter-url';
	import type { PublicGameListItem } from '$lib/server/public-games';
	import { getGameEngineHexColor, getGameEngineLabel } from '$lib/utils/game-engine-colors';
	import { resolveGameImageSrc } from '$lib/utils/game-image-url';
	import { getTranslationProgressLabel } from '$lib/utils/game-translation-labels';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { onMount } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	const TAGS_PREVIEW_LIMIT = 4;

	let searchQuery = $state('');
	let sortValue = $state<PageData['sort']>('updated_desc');
	let filterGroups = $state<PageData['filterGroups']>([]);
	let tagsExpanded = $state(false);
	let viewMode = $state<GamesListViewMode>('grid');
	let expandedTagRowIds = new SvelteSet<string>();

	onMount(() => {
		try {
			const stored = localStorage.getItem(GAMES_VIEW_MODE_KEY);
			if (stored === 'grid' || stored === 'list') viewMode = stored;
		} catch {
			// ignore
		}
	});

	$effect(() => {
		try {
			localStorage.setItem(GAMES_VIEW_MODE_KEY, viewMode);
		} catch {
			// ignore
		}
	});

	$effect(() => {
		searchQuery = data.query;
		sortValue = data.sort;
		filterGroups = structuredClone(data.filterGroups);
	});

	$effect(() => {
		if (tagsExpanded) expandedTagRowIds.clear();
	});

	const expandRowTags = (gameId: string) => {
		expandedTagRowIds.add(gameId);
	};

	const collapseRowTags = (gameId: string) => {
		expandedTagRowIds.delete(gameId);
	};

	const rowTagsExpanded = (gameId: string) => tagsExpanded || expandedTagRowIds.has(gameId);

	const listParams = $derived.by(
		(): PublicGamesListParams => ({
			page: data.page,
			query: data.query,
			sort: data.sort,
			filters: data.filters
		})
	);

	const gamesHref = (page: number) => {
		const params = buildPublicGamesListSearchParams({ ...listParams, page });
		const search = params.toString();
		return search ? `${resolve('/games')}?${search}` : resolve('/games');
	};

	const translationStatusClass = (status: string | null) => {
		switch (status) {
			case 'completed':
				return 'badge badge-success badge-soft';
			case 'in_progress':
				return 'badge badge-info badge-soft';
			case 'abandoned':
				return 'badge badge-warning badge-soft';
			default:
				return 'badge badge-neutral badge-soft';
		}
	};

	const websiteLabel = (website: string) => {
		switch (website) {
			case 'f95z':
				return 'F95';
			case 'lc':
				return 'LC';
			default:
				return 'Autre';
		}
	};

	const resultSummary = $derived.by(() => {
		if (data.error) return '';
		const hasFilters = hasActivePublicGamesListFilters(listParams);
		const countLabel = `${data.total} jeu${data.total > 1 ? 'x' : ''}`;
		if (hasFilters) {
			return `${countLabel} trouvé${data.total > 1 ? 's' : ''}`;
		}
		return `${countLabel} référencé${data.total > 1 ? 's' : ''}`;
	});

	const hasFilters = $derived(hasActivePublicGamesListFilters(listParams));

	const upToDateLabel = (game: PublicGameListItem) =>
		game.translationCount > 0 ? `${game.upToDateTranslationCount} / ${game.translationCount}` : '—';
</script>

{#snippet gameTags(game: PublicGameListItem)}
	{#if game.tags.length}
		{@const showAllTags = rowTagsExpanded(game.id)}
		{@const visibleTags = showAllTags ? game.tags : game.tags.slice(0, TAGS_PREVIEW_LIMIT)}
		{@const hiddenTagsCount = game.tags.length - visibleTags.length}
		<div class="flex flex-wrap items-center gap-1">
			{#each visibleTags as tag (tag)}
				<span class="badge badge-xs badge-ghost">{tag}</span>
			{/each}
			{#if !tagsExpanded && expandedTagRowIds.has(game.id) && game.tags.length > TAGS_PREVIEW_LIMIT}
				<button
					type="button"
					class="btn h-auto min-h-0 px-1 py-0 text-xs font-normal btn-ghost"
					onclick={() => collapseRowTags(game.id)}
				>
					Replier
				</button>
			{:else if !showAllTags && hiddenTagsCount > 0}
				<button
					type="button"
					class="btn h-auto min-h-0 px-1 py-0 text-xs font-normal btn-ghost"
					onclick={() => expandRowTags(game.id)}
				>
					Voir plus ({hiddenTagsCount})
				</button>
			{/if}
		</div>
	{:else}
		<span class="text-base-content/60">—</span>
	{/if}
{/snippet}

{#snippet gameListRow(game: PublicGameListItem)}
	{@const imageSrc = resolveGameImageSrc(game.image, { website: game.website })}
	<li class="list-row items-start gap-3 py-3 hover:bg-base-200 w-full">
		<div class="relative h-20 w-32 shrink-0">
			<a
				href={resolve(`/games/${game.id}`)}
				class="block h-full w-full"
				aria-hidden="true"
				tabindex="-1"
			>
				{#if imageSrc}
					<img
						class="aspect-video h-full w-full rounded-box object-cover"
						src={imageSrc}
						alt=""
						loading="lazy"
						referrerpolicy="no-referrer"
					/>
				{:else}
					<div
						class="flex aspect-video h-full w-full items-center justify-center rounded-box bg-base-300 text-xs text-base-content/50"
					>
						Pas d’aperçu
					</div>
				{/if}
			</a>
			<span class="badge pointer-events-none absolute top-1 left-1 badge-xs badge-neutral">
				{websiteLabel(game.website)}
			</span>
		</div>

		<div class="min-w-0 list-col-grow gap-2">
			<div class="flex flex-wrap items-start gap-2">
				{#each game.engineTypes as engine (engine)}
					<span
						class="badge badge-xs badge-outline"
						style={`border-color: ${getGameEngineHexColor(engine)}; color: ${getGameEngineHexColor(engine)}`}
					>
						{getGameEngineLabel(engine)}
					</span>
				{/each}
				<a
					href={resolve(`/games/${game.id}`)}
					class="link link-hover line-clamp-2 font-medium leading-snug"
				>
					{game.name}
				</a>
			</div>

			<dl class="flex flex-col gap-2 text-sm sm:flex-row sm:gap-8">
				<div class="flex justify-between gap-2 sm:block">
					<dt class="text-base-content/60">Version jeu</dt>
					<dd class="font-medium">{game.gameVersion?.trim() || '—'}</dd>
				</div>
				{#if game.translationCount > 0}
					<div class="flex justify-between gap-2 sm:block">
						<dt class="text-base-content/60">Traductions à jour</dt>
						<dd class="font-medium">{upToDateLabel(game)}</dd>
					</div>
					<div class="flex justify-between gap-2 sm:block">
						<dt class="text-base-content/60">Traduction</dt>
						<dd>
							<span class={translationStatusClass(game.translationStatus)}>
								{game.translationStatusLabel ??
									getTranslationProgressLabel(game.translationStatus ?? '')}
							</span>
						</dd>
					</div>
				{:else}
					<div class="text-base-content/60 sm:col-span-2">Aucune traduction enregistrée</div>
				{/if}
			</dl>

			<dl class="flex items-center gap-2 text-sm">
				<dt class="shrink-0 text-base-content/60">Tags</dt>
				<dd class="min-w-0">{@render gameTags(game)}</dd>
			</dl>

			{#if game.translationCount > 1}
				<p class="text-xs text-base-content/50">{game.translationCount} traductions au total</p>
			{/if}
		</div>

		<div class="flex shrink-0 flex-col gap-1 my-auto">
			<a href={resolve(`/games/${game.id}`)} class="btn btn-sm btn-ghost">Fiche du jeu</a>
		</div>
	</li>
{/snippet}

{#snippet gameGridCard(game: PublicGameListItem)}
	{@const imageSrc = resolveGameImageSrc(game.image, { website: game.website })}
	<article class="card card-border bg-base-100 shadow-sm transition hover:shadow-md">
		<figure class="relative aspect-video overflow-hidden bg-base-300">
			<a
				href={resolve(`/games/${game.id}`)}
				class="block h-full w-full"
				aria-label={`Voir la fiche de ${game.name}`}
			>
				{#if imageSrc}
					<img
						src={imageSrc}
						alt=""
						class="h-full w-full object-cover"
						loading="lazy"
						referrerpolicy="no-referrer"
					/>
				{:else}
					<div class="flex h-full w-full items-center justify-center text-sm text-base-content/50">
						Pas d’aperçu
					</div>
				{/if}
			</a>
			<span class="badge pointer-events-none absolute top-2 left-2 badge-sm badge-neutral">
				{websiteLabel(game.website)}
			</span>
		</figure>
		<div class="card-body gap-2 p-4">
			<h2 class="card-title text-base leading-snug line-clamp-1">
				<a href={resolve(`/games/${game.id}`)} class="link link-hover line-clamp-1">
					{game.name}
				</a>
			</h2>
			<div class="flex flex-wrap gap-1">
				{#each game.engineTypes as engine (engine)}
					<span
						class="badge badge-xs badge-outline"
						style={`border-color: ${getGameEngineHexColor(engine)}; color: ${getGameEngineHexColor(engine)}`}
					>
						{getGameEngineLabel(engine)}
					</span>
				{/each}
			</div>
			<dl class="grid gap-1 text-sm">
				<div class="flex justify-between gap-2">
					<dt class="text-base-content/60">Version jeu</dt>
					<dd class="font-medium">{game.gameVersion?.trim() || '—'}</dd>
				</div>
				{#if game.translationCount > 0}
					<div class="flex justify-between gap-2">
						<dt class="text-base-content/60">Traductions à jour</dt>
						<dd class="font-medium">{upToDateLabel(game)}</dd>
					</div>
					<div class="flex justify-between gap-2">
						<dt class="text-base-content/60">Traduction</dt>
						<dd>
							<span class={translationStatusClass(game.translationStatus)}>
								{game.translationStatusLabel ??
									getTranslationProgressLabel(game.translationStatus ?? '')}
							</span>
						</dd>
					</div>
				{:else}
					<div class="text-base-content/60">Aucune traduction enregistrée</div>
				{/if}
			</dl>
			<dl class="flex flex-col gap-2 text-sm h-fit">
				<dt class="shrink-0 text-base-content/60">Tags</dt>
				<dd>{@render gameTags(game)}</dd>
			</dl>
			{#if game.translationCount > 1}
				<p class="text-xs text-base-content/50">{game.translationCount} traductions au total</p>
			{/if}
		</div>
	</article>
{/snippet}

<svelte:head>
	<title>Jeux — F95 France</title>
	<meta
		name="description"
		content="Parcourez la liste des jeux traduits par la communauté F95 France."
	/>
</svelte:head>

<main class="mx-auto flex w-full flex-1 flex-col lg:flex-row-reverse gap-4 px-4 py-8 lg:px-8">
	<section
		class="card border border-base-300 bg-base-100 shadow-sm h-full lg:sticky lg:top-8 lg:max-w-xs"
	>
		<div class="card-body gap-4 max-h-[calc(100vh-4rem)] overflow-y-auto">
			<GamesFilterContent
				bind:query={searchQuery}
				bind:sort={sortValue}
				bind:filterGroups
				translatorIds={data.translatorIds}
				isAuthenticated={data.isAuthenticated}
				initialSavedFilters={data.savedFilters}
				showTagsExpandToggle
				bind:tagsExpanded
				showViewModeToggle
				bind:viewMode
				disabled={Boolean(data.error)}
			/>
		</div>
	</section>

	<section class="flex flex-col gap-4 w-full">
		<header class="flex flex-col gap-3">
			<h1 class="text-3xl font-bold">Jeux</h1>
		</header>
		{#if data.error}
			<div role="alert" class="alert alert-warning">
				<span>{data.error}</span>
			</div>
		{:else}
			<p class="text-sm text-base-content/60">{resultSummary}</p>
			{#if !data.games.length}
				<div class="card border border-base-300 bg-base-100">
					<div class="card-body items-start gap-2">
						<h2 class="card-title text-lg">Aucun jeu trouvé</h2>
						<p class="text-base-content/70">
							{#if hasFilters}
								Essayez d’élargir vos critères ou réinitialisez les filtres.
							{:else}
								La liste sera alimentée lorsque des jeux seront ajoutés au catalogue.
							{/if}
						</p>
						{#if hasFilters}
							<a href={resolve('/games')} class="btn btn-sm btn-primary"
								>Réinitialiser les filtres</a
							>
						{/if}
					</div>
				</div>
			{:else}
				{#if viewMode === 'list'}
					<ul class="list rounded-box bg-base-100 shadow-md">
						{#each data.games as game (game.id)}
							{@render gameListRow(game)}
						{/each}
					</ul>
				{:else}
					<div
						class="grid grid-cols-1 gap-4 xs:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
					>
						{#each data.games as game (game.id)}
							{@render gameGridCard(game)}
						{/each}
					</div>
				{/if}
				{#if data.totalPages > 1}
					<nav
						class="flex flex-wrap items-center justify-center gap-2"
						aria-label="Pagination des jeux"
					>
						{#if data.page > 1}
							<a href={gamesHref(data.page - 1)} class="btn btn-sm btn-ghost gap-1">
								<ChevronLeft class="h-4 w-4" />
								Précédent
							</a>
						{/if}
						<span class="px-2 text-sm text-base-content/70">
							Page {data.page} / {data.totalPages}
						</span>
						{#if data.page < data.totalPages}
							<a href={gamesHref(data.page + 1)} class="btn btn-sm btn-ghost gap-1">
								Suivant
								<ChevronRight class="h-4 w-4" />
							</a>
						{/if}
					</nav>
				{/if}
			{/if}
		{/if}
	</section>
</main>
