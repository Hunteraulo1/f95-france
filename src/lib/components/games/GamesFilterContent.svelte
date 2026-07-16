<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import GamesFilterPopover from '$lib/components/games/GamesFilterPopover.svelte';
	import {
		createDefaultGamesFilterGroups,
		MAX_SAVED_GAMES_FILTERS,
		SAVED_GAMES_FILTERS_KEY,
		type GamesFilterGroupState,
		type SavedGamesFilterPreset
	} from '$lib/games/games-filter-config';
	import { hasActiveGamesFilterGroups } from '$lib/games/games-filter-state';
	import {
		buildPublicGamesListSearchParams,
		cloneFilterGroups,
		filterGroupsToSelections
	} from '$lib/games/games-filter-url';
	import { PUBLIC_GAMES_SORT_OPTIONS } from '$lib/games/public-games-query';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import CircleHelp from '@lucide/svelte/icons/circle-help';
	import Plus from '@lucide/svelte/icons/plus';
	import X from '@lucide/svelte/icons/x';
	import { onMount } from 'svelte';

	type SortOption = { value: string; label: string };

	type BuildSearchParams = (params: {
		query: string;
		sort: string;
		page?: number;
		filters: ReturnType<typeof filterGroupsToSelections>;
	}) => URLSearchParams;

	interface Props {
		query: string;
		sort?: string;
		filterGroups: GamesFilterGroupState[];
		translatorIds: { id: string; name: string }[];
		basePath?: '/games' | '/updates';
		sortOptions?: readonly SortOption[];
		defaultSort?: string;
		savedFiltersKey?: string;
		savedFiltersApiPath?: string | null;
		maxSavedFilters?: number;
		buildSearchParams?: BuildSearchParams;
		createDefaultFilterGroups?: (
			translators: { id: string; name: string }[]
		) => GamesFilterGroupState[];
		cloneGroups?: (groups: GamesFilterGroupState[]) => GamesFilterGroupState[];
		isAuthenticated?: boolean;
		initialSavedFilters?: SavedGamesFilterPreset[];
		disabled?: boolean;
		showSort?: boolean;
		showTagsExpandToggle?: boolean;
		tagsExpanded?: boolean;
		showViewModeToggle?: boolean;
		viewMode?: 'grid' | 'list';
	}

	let {
		query = $bindable(''),
		sort = $bindable('updated_desc'),
		filterGroups = $bindable([]),
		translatorIds,
		basePath = '/games',
		sortOptions = PUBLIC_GAMES_SORT_OPTIONS,
		defaultSort = 'updated_desc',
		savedFiltersKey = SAVED_GAMES_FILTERS_KEY,
		savedFiltersApiPath = '/api/saved-filters/games',
		maxSavedFilters = MAX_SAVED_GAMES_FILTERS,
		buildSearchParams = buildPublicGamesListSearchParams,
		createDefaultFilterGroups = createDefaultGamesFilterGroups,
		cloneGroups = cloneFilterGroups,
		isAuthenticated = false,
		initialSavedFilters = [],
		disabled = false,
		showSort = true,
		showTagsExpandToggle = false,
		tagsExpanded = $bindable(false),
		showViewModeToggle = false,
		viewMode = $bindable('grid')
	}: Props = $props();

	let savedFilters = $state<SavedGamesFilterPreset[]>([]);
	let filterRemoveIndex = $state<number | null>(null);
	let savedFiltersHelpOpen = $state(false);

	onMount(() => {
		if (isAuthenticated) {
			savedFilters = initialSavedFilters.slice(0, maxSavedFilters);
			return;
		}
		try {
			const raw = localStorage.getItem(savedFiltersKey);
			if (!raw) return;
			const parsed = JSON.parse(raw) as SavedGamesFilterPreset[];
			if (Array.isArray(parsed)) savedFilters = parsed.slice(0, maxSavedFilters);
		} catch {
			savedFilters = [];
		}
	});

	$effect(() => {
		if (isAuthenticated) {
			savedFilters = initialSavedFilters.slice(0, maxSavedFilters);
		}
	});

	const listHref = (search: string) =>
		search ? resolve(`${basePath}?${search}` as '/games' | '/updates') : resolve(basePath);

	const persistSaved = () => {
		if (isAuthenticated) return;
		localStorage.setItem(savedFiltersKey, JSON.stringify(savedFilters));
	};

	const persistSavedToDb = async () => {
		if (!isAuthenticated || !savedFiltersApiPath) return;
		try {
			await fetch(resolve(savedFiltersApiPath as '/api/saved-filters/games'), {
				method: 'PUT',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ filters: savedFilters })
			});
		} catch (error) {
			console.error('Impossible d’enregistrer les filtres en base:', error);
		}
	};

	const navigateWithCurrentFilters = (page = 1) => {
		const params = buildSearchParams({
			query: query.trim(),
			sort,
			page,
			filters: filterGroupsToSelections(filterGroups)
		});
		const search = params.toString();
		void goto(listHref(search), {
			keepFocus: true,
			noScroll: false
		});
	};

	const handleReset = () => {
		query = '';
		sort = defaultSort;
		filterGroups = createDefaultFilterGroups(translatorIds);
		filterRemoveIndex = null;
		void goto(resolve(basePath), { keepFocus: true });
	};

	const handleApply = () => {
		navigateWithCurrentFilters(1);
	};

	const handleSavedClick = (preset: SavedGamesFilterPreset, index: number) => {
		if (filterRemoveIndex === index) {
			filterRemoveIndex = null;
			savedFilters = savedFilters.filter((_, i) => i !== index);
			persistSaved();
			void persistSavedToDb();
			handleReset();
			return;
		}

		filterRemoveIndex = null;
		query = preset.query;
		sort = preset.sort || defaultSort;
		filterGroups = cloneGroups(preset.groups);
		navigateWithCurrentFilters(1);
	};

	const handleSavedAdd = () => {
		filterRemoveIndex = null;
		if (savedFilters.length >= maxSavedFilters) return;

		savedFilters = [
			...savedFilters,
			{
				query: query.trim(),
				sort,
				groups: cloneGroups(filterGroups)
			}
		];
		persistSaved();
		void persistSavedToDb();
	};

	const handleSavedRemovePrompt = (index: number) => {
		filterRemoveIndex = index;
		setTimeout(() => {
			filterRemoveIndex = null;
		}, 2000);
	};

	const onFilterGroupsChange = (next: GamesFilterGroupState[]) => {
		filterGroups = next;
	};

	const selectedSortLabel = $derived(
		sortOptions.find((option) => option.value === sort)?.label ?? 'Tri'
	);

	const handleSortSelect = (value: string) => {
		if (disabled) return;
		sort = value;
	};

	const hasActiveFilters = $derived(
		Boolean(query.trim()) ||
			(showSort && sort !== defaultSort) ||
			hasActiveGamesFilterGroups(filterGroups)
	);
</script>

<div class="flex flex-col gap-4">
	<div class="flex flex-col gap-2">
		<div class="flex flex-wrap items-center gap-x-2 gap-y-1">
			<span class="text-sm font-medium">Filtrages sauvegardés</span>
			<button
				type="button"
				class="btn btn-circle h-6 min-h-0 w-6 btn-ghost btn-xs"
				aria-label="Aide — filtrages sauvegardés"
				aria-expanded={savedFiltersHelpOpen}
				onclick={() => (savedFiltersHelpOpen = !savedFiltersHelpOpen)}
			>
				<CircleHelp class="h-3.5 w-3.5 opacity-70" />
			</button>
		</div>
		{#if savedFiltersHelpOpen}
			<div
				class="w-full rounded-box border border-base-300 bg-base-200/50 p-3 text-sm"
				role="region"
				aria-label="Aide filtrages sauvegardés"
			>
				<p class="mb-2 font-medium">Comment ça marche</p>
				<ul class="list-disc space-y-1.5 pl-4 text-base-content/80">
					<li>
						<span class="font-medium text-base-content">+</span> enregistre la recherche, le tri et
						les filtres actuels (max. {maxSavedFilters})
					</li>
					<li>
						<span class="font-medium text-base-content">1, 2, 3…</span> applique ce filtre
					</li>
					<li>
						<span class="font-medium text-base-content">Supprimer</span> double-clic sur le numéro,
						puis clic sur <span class="font-medium">✕</span> (sous 2 s)
					</li>
				</ul>
				<p class="mt-2 border-t border-base-300 pt-2 text-xs text-base-content/60">
					{#if isAuthenticated}
						Synchronisés avec votre compte F95 France.
					{:else}
						Stockés uniquement dans ce navigateur (connexion requise pour la synchro).
					{/if}
				</p>
			</div>
		{/if}
		<div class="flex flex-wrap gap-2 lg:items-center">
			{#each savedFilters as preset, index (index)}
				<button
					type="button"
					class="btn btn-circle font-bold btn-sm {filterRemoveIndex === index
						? 'btn-error'
						: 'btn-secondary'}"
					title={filterRemoveIndex === index
						? 'Confirmer la suppression'
						: 'Appliquer ce filtre (double-clic pour supprimer)'}
					onclick={() => handleSavedClick(preset, index)}
					ondblclick={() => handleSavedRemovePrompt(index)}
				>
					{#if filterRemoveIndex === index}
						<X class="h-4 w-4" />
					{:else}
						{index + 1}
					{/if}
				</button>
			{/each}
			{#if savedFilters.length < maxSavedFilters}
				<button
					type="button"
					class="btn btn-circle btn-primary btn-sm"
					title="Sauvegarder les filtres actuels"
					onclick={handleSavedAdd}
					{disabled}
				>
					<Plus class="h-4 w-4" />
				</button>
			{/if}
		</div>
	</div>

	<div class="flex flex-col gap-2">
		<label class="form-control min-w-0 flex-1">
			<span class="label py-1">
				<span class="label-text text-xs font-bold">Nom</span>
			</span>
			<input
				type="search"
				class="input-bordered input w-full input-sm"
				placeholder="Rechercher un nom ou un n° de thread"
				bind:value={query}
				{disabled}
				onkeydown={(e) => {
					if (e.key === 'Enter') {
						e.preventDefault();
						handleApply();
					}
				}}
			/>
		</label>
		<div class="flex gap-2 lg:w-full">
			<button
				type="button"
				class="btn btn-primary btn-sm lg:w-1/2"
				onclick={handleApply}
				{disabled}
			>
				Appliquer
			</button>
			<button
				type="button"
				class="btn btn-ghost btn-sm"
				onclick={handleReset}
				disabled={disabled || !hasActiveFilters}
			>
				Réinitialiser
			</button>
		</div>
	</div>

	<div class="grid gap-3 lg:flex lg:flex-row lg:flex-wrap">
		{#each filterGroups as group (group.name)}
			<GamesFilterPopover
				{group}
				{disabled}
				allGroups={filterGroups}
				onchange={onFilterGroupsChange}
			/>
		{/each}
	</div>

	{#if showViewModeToggle}
		<div class="hidden flex-col gap-2 rounded-box border border-base-300 px-3 py-2 md:flex">
			<span class="text-sm font-medium">Affichage</span>
			<div class="join w-full">
				<button
					type="button"
					class="btn join-item flex-1 btn-sm {viewMode === 'grid' ? 'btn-primary' : 'btn-ghost'}"
					onclick={() => (viewMode = 'grid')}
					{disabled}
				>
					Grille
				</button>
				<button
					type="button"
					class="btn join-item flex-1 btn-sm {viewMode === 'list' ? 'btn-primary' : 'btn-ghost'}"
					onclick={() => (viewMode = 'list')}
					{disabled}
				>
					Liste
				</button>
			</div>
		</div>
	{/if}

	{#if showTagsExpandToggle}
		<label
			class="flex cursor-pointer items-center justify-between gap-3 rounded-box border border-base-300 px-3 py-2"
		>
			<span class="text-sm font-medium">Tags dépliés</span>
			<input
				type="checkbox"
				class="toggle toggle-primary toggle-sm"
				bind:checked={tagsExpanded}
				{disabled}
			/>
		</label>
	{/if}

	{#if showSort}
		<label class="form-control w-full">
			<span class="label py-1">
				<span class="label-text text-xs font-medium">Tri</span>
			</span>
			<div class="dropdown w-full">
				<div
					tabindex={disabled ? -1 : 0}
					role="button"
					class="btn w-full justify-between btn-outline font-normal btn-sm"
					class:btn-disabled={disabled}
				>
					<span class="truncate text-left">{selectedSortLabel}</span>
					<ChevronDown class="h-4 w-4 shrink-0 opacity-60" />
				</div>
				<div
					tabindex={disabled ? -1 : 0}
					role="menu"
					class="dropdown-content z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-box border border-base-300 bg-base-100 p-1 shadow-lg"
				>
					<ul class="menu w-full p-0">
						{#each sortOptions as option (option.value)}
							<li>
								<button
									type="button"
									class={option.value === sort ? 'menu-active bg-base-300 font-medium' : ''}
									onclick={() => handleSortSelect(option.value)}
									{disabled}
								>
									{option.label}
								</button>
							</li>
						{/each}
					</ul>
				</div>
			</div>
		</label>
	{/if}
</div>
