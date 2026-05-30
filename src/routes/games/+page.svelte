<script lang="ts">
	import { resolve } from '$app/paths';
	import GamesFilterContent from '$lib/components/games/GamesFilterContent.svelte';
	import {
		buildPublicGamesListSearchParams,
		hasActivePublicGamesListFilters,
		type PublicGamesListParams
	} from '$lib/games/games-filter-url';
	import { getGameEngineHexColor, getGameEngineLabel } from '$lib/utils/game-engine-colors';
	import { resolveGameImageSrc } from '$lib/utils/game-image-url';
	import { getTranslationProgressLabel } from '$lib/utils/game-translation-labels';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
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
	let expandedTagRowIds = new SvelteSet<string>();

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
</script>

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
				disabled={Boolean(data.error)}
			/>
		</div>
	</section>

	<section class="flex flex-col gap-4">
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
				<div
					class="grid grid-cols-1 gap-4 xs:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
				>
					{#each data.games as game (game.id)}
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
										<div
											class="flex h-full w-full items-center justify-center text-sm text-base-content/50"
										>
											Pas d’aperçu
										</div>
									{/if}
								</a>
								<span
									class="badge pointer-events-none absolute top-2 left-2 badge-sm badge-neutral"
								>
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
											<dt class="text-base-content/60">Trad. ver.</dt>
											<dd class="font-medium">{game.translationVersion?.trim() || '—'}</dd>
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
									<dd>
										{#if game.tags.length}
											{@const showAllTags = rowTagsExpanded(game.id)}
											{@const visibleTags = showAllTags
												? game.tags
												: game.tags.slice(0, TAGS_PREVIEW_LIMIT)}
											{@const hiddenTagsCount = game.tags.length - visibleTags.length}
											<div class="flex flex-wrap items-center gap-1">
												{#each visibleTags as tag (tag)}
													<span class="badge badge-xs badge-ghost">{tag}</span>
												{/each}
												{#if !tagsExpanded && expandedTagRowIds.has(game.id) && game.tags.length > TAGS_PREVIEW_LIMIT}
													<button
														type="button"
														class="btn h-auto min-h-0 px-1 py-0 font-normal btn-ghost text-xs"
														onclick={() => collapseRowTags(game.id)}
													>
														Replier
													</button>
												{:else if !showAllTags && hiddenTagsCount > 0}
													<button
														type="button"
														class="btn h-auto min-h-0 px-1 py-0 font-normal btn-ghost text-xs"
														onclick={() => expandRowTags(game.id)}
													>
														Voir plus ({hiddenTagsCount})
													</button>
												{/if}
											</div>
										{:else}
											<span class="text-base-content/60">—</span>
										{/if}
									</dd>
								</dl>
								{#if game.translationCount > 1}
									<p class="text-xs text-base-content/50">
										{game.translationCount} traductions au total
									</p>
								{/if}
							</div>
						</article>
					{/each}
				</div>
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
