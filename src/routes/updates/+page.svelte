<script lang="ts">
	import { resolve } from '$app/paths';
	import GamesFilterContent from '$lib/components/games/GamesFilterContent.svelte';
	import Pagination from '$lib/components/Pagination.svelte';
	import { type GamesListViewMode } from '$lib/games/games-filter-config';
	import {
		formatTranslationVersionDisplay,
		translationVersionSyncBadgeClass,
		translationVersionSyncLabel
	} from '$lib/games/public-game-display';
	import type { PublicUpdateRow } from '$lib/server/public-updates';
	import { groupUpdatesByDayAndType } from '$lib/updates/group-updates-by-day';
	import {
		createDefaultUpdatesFilterGroups,
		SAVED_UPDATES_FILTERS_KEY,
		SAVED_UPDATES_VIEW_MODE_KEY
	} from '$lib/updates/updates-filter-config';
	import {
		buildPublicUpdatesListSearchParams,
		cloneUpdatesFilterGroups,
		hasActivePublicUpdatesListFilters,
		type PublicUpdatesListParams
	} from '$lib/updates/updates-filter-url';
	import { getGameEngineHexColor, getGameEngineLabel } from '$lib/utils/game-engine-colors';
	import { resolveGameImageSrc } from '$lib/utils/game-image-url';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import { onMount } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	const TAGS_PREVIEW_LIMIT = 4;

	let searchQuery = $derived(data.query);
	let filterGroups = $derived(structuredClone(data.filterGroups));
	let tagsExpanded = $state(false);
	let viewMode = $state<GamesListViewMode>('list');
	let isMobileViewport = $state(false);
	let expandedTagRowIds = new SvelteSet<string>();
	const displayViewMode = $derived(isMobileViewport ? 'grid' : viewMode);

	onMount(() => {
		const mobileQuery = window.matchMedia('(max-width: 767px)');
		const syncMobileViewport = () => {
			isMobileViewport = mobileQuery.matches;
		};

		try {
			const stored = localStorage.getItem(SAVED_UPDATES_VIEW_MODE_KEY);
			if (stored === 'grid' || stored === 'list') viewMode = stored;
		} catch {
			// ignore
		}

		syncMobileViewport();
		mobileQuery.addEventListener('change', syncMobileViewport);
		return () => {
			mobileQuery.removeEventListener('change', syncMobileViewport);
		};
	});

	$effect(() => {
		try {
			localStorage.setItem(SAVED_UPDATES_VIEW_MODE_KEY, viewMode);
		} catch {
			// ignore
		}
	});

	$effect(() => {
		if (tagsExpanded) expandedTagRowIds.clear();
	});

	const expandRowTags = (updateId: string) => {
		expandedTagRowIds.add(updateId);
	};

	const collapseRowTags = (updateId: string) => {
		expandedTagRowIds.delete(updateId);
	};

	const rowTagsExpanded = (updateId: string) => tagsExpanded || expandedTagRowIds.has(updateId);

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

	const websiteBadgeClass = (website: string, size: 'xs' | 'sm') => {
		const sizeClass = size === 'xs' ? 'badge-xs' : 'badge-sm';
		return `badge ${sizeClass} badge-secondary`;
	};

	const formatTime = (value: Date) =>
		new Date(value).toLocaleTimeString('fr-FR', {
			hour: '2-digit',
			minute: '2-digit'
		});

	const groupedUpdates = $derived(groupUpdatesByDayAndType(data.updates));

	const listParams = $derived.by(
		(): PublicUpdatesListParams => ({
			page: data.page,
			query: data.query,
			filters: data.filters
		})
	);

	const updatesHref = (page: number) => {
		const params = buildPublicUpdatesListSearchParams({ ...listParams, page });
		const search = params.toString();
		return search ? resolve(`/updates?${search}` as '/updates') : resolve('/updates');
	};

	const resultSummary = $derived.by(() => {
		if (data.error) return '';
		const hasFilters = hasActivePublicUpdatesListFilters(listParams);
		const countLabel = `${data.total} mise${data.total > 1 ? 's' : ''} à jour`;
		if (hasFilters) {
			return `${countLabel} trouvée${data.total > 1 ? 's' : ''}`;
		}
		return countLabel;
	});

	const hasFilters = $derived(hasActivePublicUpdatesListFilters(listParams));
</script>

{#snippet updateRow(update: PublicUpdateRow)}
	{@const imageSrc = resolveGameImageSrc(update.game.image, {
		website: update.game.website
	})}
	{@const game = update.game}
	<li class="list-row items-start gap-3 py-3 hover:bg-base-200">
		<div class="relative h-20 w-32 shrink-0">
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
			<span
				class={`pointer-events-none absolute top-1 left-1 ${websiteBadgeClass(game.website, 'xs')}`}
			>
				{websiteLabel(game.website)}
			</span>
		</div>

		<div class="min-w-0 list-col-grow gap-2 h-full">
			<div class="flex w-full text-nowrap gap-2">
				{#if game.hasTranslation}
					<dd class="flex flex-col items-start gap-1">
						<span
							class={translationVersionSyncBadgeClass(game.isOutdated, game.isIntegrated) +
								' badge-xs'}
						>
							{translationVersionSyncLabel(game.isOutdated, game.isIntegrated)}
						</span>
					</dd>
				{/if}
				{#if game.engineType}
					<div class="flex flex-wrap gap-1">
						<span
							class="badge badge-xs badge-outline"
							style={`border-color: ${getGameEngineHexColor(game.engineType)}; color: ${getGameEngineHexColor(game.engineType)}`}
						>
							{getGameEngineLabel(game.engineType)}
						</span>
					</div>
				{/if}
				<div class="flex flex-wrap items-start justify-between gap-2">
					<a
						href={resolve(`/games/${game.id}`)}
						class="link link-hover line-clamp-2 font-medium leading-snug"
					>
						{game.name}
					</a>
				</div>
				<time class="shrink-0 text-xs opacity-60 ml-auto" datetime={update.createdAt.toISOString()}>
					{formatTime(update.createdAt)}
				</time>
			</div>

			{#if game.hasTranslation}
				<dd class="flex flex-col items-start gap-1">
					<span class="font-medium"
						>{formatTranslationVersionDisplay({
							tversion: game.tversion,
							referenceVersion: game.referenceVersion,
							isOutdated: game.isOutdated,
							isIntegrated: game.isIntegrated
						})}</span
					>
				</dd>
			{:else}
				<dd class="text-base-content/60">Aucune traduction enregistrée</dd>
			{/if}

			<dl class="flex items-center gap-2">
				<dt class="text-base-content/60 text-nowrap">Tags:</dt>
				<dd>
					{#if game.tags.length}
						{@const showAllTags = rowTagsExpanded(update.id)}
						{@const visibleTags = showAllTags ? game.tags : game.tags.slice(0, TAGS_PREVIEW_LIMIT)}
						{@const hiddenTagsCount = game.tags.length - visibleTags.length}
						<div class="flex flex-wrap items-center gap-1">
							{#each visibleTags as tag (tag)}
								<span class="badge badge-xs badge-ghost">{tag}</span>
							{/each}
							{#if !tagsExpanded && expandedTagRowIds.has(update.id) && game.tags.length > TAGS_PREVIEW_LIMIT}
								<button
									type="button"
									class="btn btn-xs btn-ghost h-auto min-h-0 px-1 py-0 font-normal"
									onclick={() => collapseRowTags(update.id)}
								>
									Replier
								</button>
							{:else if !showAllTags && hiddenTagsCount > 0}
								<button
									type="button"
									class="btn btn-xs btn-ghost h-auto min-h-0 px-1 py-0 font-normal"
									onclick={() => expandRowTags(update.id)}
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
		</div>

		<div class="flex shrink-0 flex-col gap-1 items-end">
			<a
				href={resolve(`/games/${game.id}`)}
				class="btn btn-sm btn-ghost w-full px-2"
				aria-label={`Fiche de ${game.name}`}
			>
				Voir la fiche
			</a>

			{#if game.link?.trim()}
				<a
					href={game.link}
					target="_blank"
					rel="noopener noreferrer"
					class="btn btn-square btn-ghost btn-sm w-full px-2"
					aria-label={`Thread de ${game.name}`}
					title="Ouvrir le thread"
				>
					Voir le thread
					<ExternalLink class="size-4" />
				</a>
			{/if}
		</div>
	</li>
{/snippet}

{#snippet updateGridCard(update: PublicUpdateRow)}
	{@const imageSrc = resolveGameImageSrc(update.game.image, {
		website: update.game.website
	})}
	{@const game = update.game}
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
			<span
				class={`pointer-events-none absolute top-2 left-2 ${websiteBadgeClass(game.website, 'sm')}`}
			>
				{websiteLabel(game.website)}
			</span>
		</figure>
		<div class="card-body gap-2 p-4">
			<div class="flex items-start gap-2">
				<h2 class="card-title text-base leading-snug line-clamp-2">
					<a href={resolve(`/games/${game.id}`)} class="link link-hover line-clamp-2">
						{game.name}
					</a>
				</h2>
				<time class="ml-auto shrink-0 text-xs opacity-60" datetime={update.createdAt.toISOString()}>
					{formatTime(update.createdAt)}
				</time>
			</div>
			{#if game.engineType}
				<div class="flex flex-wrap gap-1">
					<span
						class="badge badge-xs badge-outline"
						style={`border-color: ${getGameEngineHexColor(game.engineType)}; color: ${getGameEngineHexColor(game.engineType)}`}
					>
						{getGameEngineLabel(game.engineType)}
					</span>
				</div>
			{/if}
			{#if game.hasTranslation}
				<span
					class={translationVersionSyncBadgeClass(game.isOutdated, game.isIntegrated) + ' badge-xs'}
				>
					{translationVersionSyncLabel(game.isOutdated, game.isIntegrated)}
				</span>
				<p class="text-sm font-medium">
					{formatTranslationVersionDisplay({
						tversion: game.tversion,
						referenceVersion: game.referenceVersion,
						isOutdated: game.isOutdated,
						isIntegrated: game.isIntegrated
					})}
				</p>
			{:else}
				<p class="text-sm text-base-content/60">Aucune traduction enregistrée</p>
			{/if}
			<div class="flex flex-wrap items-center gap-1">
				{#each game.tags.slice(0, TAGS_PREVIEW_LIMIT) as tag (tag)}
					<span class="badge badge-xs badge-ghost">{tag}</span>
				{/each}
				{#if game.tags.length > TAGS_PREVIEW_LIMIT}
					<span class="text-xs text-base-content/60">+{game.tags.length - TAGS_PREVIEW_LIMIT}</span>
				{/if}
			</div>
			<div class="card-actions mt-1 justify-end">
				<a href={resolve(`/games/${game.id}`)} class="btn btn-sm btn-ghost">Voir la fiche</a>
				{#if game.link?.trim()}
					<a
						href={game.link}
						target="_blank"
						rel="noopener noreferrer"
						class="btn btn-sm btn-outline"
						aria-label={`Thread de ${game.name}`}
						title="Ouvrir le thread"
					>
						Thread
						<ExternalLink class="size-4" />
					</a>
				{/if}
			</div>
		</div>
	</article>
{/snippet}

<svelte:head>
	<title>Mises à jour — F95 France</title>
	<meta
		name="description"
		content="Consultez les dernières mises à jour et nouveautés des jeux référencés sur F95 France."
	/>
</svelte:head>

<main class="mx-auto flex w-full flex-1 flex-col gap-4 px-4 py-8 lg:flex-row-reverse lg:px-8">
	<section
		class="card h-full border border-base-300 bg-base-100 shadow-sm lg:sticky lg:top-8 lg:max-w-xs"
	>
		<div class="card-body max-h-[calc(100vh-4rem)] gap-4 overflow-y-auto">
			<GamesFilterContent
				bind:query={searchQuery}
				bind:filterGroups
				translatorIds={data.translatorIds}
				basePath="/updates"
				isAuthenticated={data.isAuthenticated}
				initialSavedFilters={data.savedFilters}
				savedFiltersKey={SAVED_UPDATES_FILTERS_KEY}
				savedFiltersApiPath="/api/updates/saved-filters"
				buildSearchParams={buildPublicUpdatesListSearchParams}
				createDefaultFilterGroups={createDefaultUpdatesFilterGroups}
				cloneGroups={cloneUpdatesFilterGroups}
				showSort={false}
				showTagsExpandToggle
				bind:tagsExpanded
				showViewModeToggle
				bind:viewMode
				disabled={Boolean(data.error)}
			/>
		</div>
	</section>

	<section class="flex w-full flex-col gap-4">
		<header class="flex flex-col gap-3">
			<h1 class="text-3xl font-bold">Mises à jour</h1>
			<p class="text-base-content/70">
				Les dernières sorties, mises à jour et ajouts de jeux suivis par la communauté.
			</p>
		</header>

		{#if data.error}
			<div role="alert" class="alert alert-warning">
				<span>{data.error}</span>
			</div>
		{:else}
			<p class="text-sm text-base-content/60">{resultSummary}</p>

			{#if !data.updates.length}
				<div class="card border border-base-300 bg-base-100">
					<div class="card-body items-start gap-2">
						<h2 class="card-title text-lg">Aucune mise à jour trouvée</h2>
						<p class="text-base-content/70">
							{#if hasFilters}
								Essayez d’élargir vos critères ou réinitialisez les filtres.
							{:else}
								La liste sera alimentée lorsque des jeux seront mis à jour.
							{/if}
						</p>
						{#if hasFilters}
							<a href={resolve('/updates')} class="btn btn-sm btn-primary"
								>Réinitialiser les filtres</a
							>
						{/if}
					</div>
				</div>
			{:else}
				{#if displayViewMode === 'list'}
					<ul class="list rounded-box bg-base-100 shadow-md">
						{#each groupedUpdates as day (day.dayKey)}
							<li class="p-4 pb-2 text-sm font-semibold tracking-wide">{day.dayLabel}</li>
							{#each day.sections as section (`${day.dayKey}-${section.status}`)}
								<li class="px-4 pb-1 text-xs font-semibold tracking-wide uppercase opacity-60">
									{section.label}
									<span class="font-normal normal-case opacity-80">
										({section.items.length})
									</span>
								</li>
								{#each section.items as update (update.id)}
									{@render updateRow(update)}
								{/each}
							{/each}
						{/each}
					</ul>
				{:else}
					<div class="flex flex-col gap-5">
						{#each groupedUpdates as day (day.dayKey)}
							<section class="flex flex-col gap-3">
								<h2 class="text-sm font-semibold tracking-wide">{day.dayLabel}</h2>
								{#each day.sections as section (`grid-${day.dayKey}-${section.status}`)}
									<div class="flex flex-col gap-2">
										<p class="text-xs font-semibold tracking-wide uppercase opacity-60">
											{section.label}
											<span class="font-normal normal-case opacity-80">
												({section.items.length})
											</span>
										</p>
										<div
											class="grid grid-cols-1 gap-4 xs:grid-cols-2 md:grid-cols-3 xl:grid-cols-4"
										>
											{#each section.items as update (update.id)}
												{@render updateGridCard(update)}
											{/each}
										</div>
									</div>
								{/each}
							</section>
						{/each}
					</div>
				{/if}

				<Pagination
					currentPage={data.page}
					totalPages={data.totalPages}
					totalCount={data.total}
					countLabel="mise à jour"
					countLabelPlural="mises à jour"
					hrefForPage={updatesHref}
				/>
			{/if}
		{/if}
	</section>
</main>
