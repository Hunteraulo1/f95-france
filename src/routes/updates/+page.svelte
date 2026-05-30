<script lang="ts">
	import { resolve } from '$app/paths';
	import GamesFilterContent from '$lib/components/games/GamesFilterContent.svelte';
	import Pagination from '$lib/components/Pagination.svelte';
	import {
		formatTranslationVersionDisplay,
		translationVersionSyncBadgeClass,
		translationVersionSyncLabel
	} from '$lib/games/public-game-display';
	import type { PublicUpdateRow } from '$lib/server/public-updates';
	import { groupUpdatesByDayAndType } from '$lib/updates/group-updates-by-day';
	import {
		createDefaultUpdatesFilterGroups,
		SAVED_UPDATES_FILTERS_KEY
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
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	const TAGS_PREVIEW_LIMIT = 4;

	let searchQuery = $derived(data.query);
	let filterGroups = $derived(structuredClone(data.filterGroups));
	let tagsExpanded = $state(false);
	let expandedTagRowIds = $state<Set<string>>(new Set());

	$effect(() => {
		if (tagsExpanded) expandedTagRowIds = new Set();
	});

	const expandRowTags = (updateId: string) => {
		expandedTagRowIds = new Set([...expandedTagRowIds, updateId]);
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
			<span class="badge pointer-events-none absolute top-1 left-1 badge-xs badge-neutral">
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
							{#if !showAllTags && hiddenTagsCount > 0}
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
				savedFiltersKey={SAVED_UPDATES_FILTERS_KEY}
				savedFiltersApiPath={null}
				buildSearchParams={buildPublicUpdatesListSearchParams}
				createDefaultFilterGroups={createDefaultUpdatesFilterGroups}
				cloneGroups={cloneUpdatesFilterGroups}
				showSort={false}
				showTagsExpandToggle
				bind:tagsExpanded
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

				<Pagination
					currentPage={data.page}
					totalPages={data.totalPages}
					totalCount={data.total}
					countLabel="mise à jour"
					hrefForPage={updatesHref}
				/>
			{/if}
		{/if}
	</section>
</main>
