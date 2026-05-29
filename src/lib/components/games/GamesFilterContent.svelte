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
	import { PUBLIC_GAMES_SORT_OPTIONS, type PublicGamesSort } from '$lib/games/public-games-query';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import Plus from '@lucide/svelte/icons/plus';
	import X from '@lucide/svelte/icons/x';
	import { onMount } from 'svelte';

	interface Props {
		query: string;
		sort: PublicGamesSort;
		filterGroups: GamesFilterGroupState[];
		translatorIds: { id: string; name: string }[];
		isAuthenticated?: boolean;
		initialSavedFilters?: SavedGamesFilterPreset[];
		disabled?: boolean;
	}

	let {
		query = $bindable(''),
		sort = $bindable('updated_desc'),
		filterGroups = $bindable([]),
		translatorIds,
		isAuthenticated = false,
		initialSavedFilters = [],
		disabled = false
	}: Props = $props();

	let savedFilters = $state<SavedGamesFilterPreset[]>([]);
	let filterRemoveIndex = $state<number | null>(null);

	onMount(() => {
		if (isAuthenticated) {
			savedFilters = initialSavedFilters.slice(0, MAX_SAVED_GAMES_FILTERS);
			return;
		}
		try {
			const raw = localStorage.getItem(SAVED_GAMES_FILTERS_KEY);
			if (!raw) return;
			const parsed = JSON.parse(raw) as SavedGamesFilterPreset[];
			if (Array.isArray(parsed)) savedFilters = parsed.slice(0, MAX_SAVED_GAMES_FILTERS);
		} catch {
			savedFilters = [];
		}
	});

	$effect(() => {
		if (isAuthenticated) {
			savedFilters = initialSavedFilters.slice(0, MAX_SAVED_GAMES_FILTERS);
		}
	});

	const persistSaved = () => {
		if (isAuthenticated) return;
		localStorage.setItem(SAVED_GAMES_FILTERS_KEY, JSON.stringify(savedFilters));
	};

	const persistSavedToDb = async () => {
		if (!isAuthenticated) return;
		try {
			await fetch(resolve('/api/games/saved-filters'), {
				method: 'PUT',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ filters: savedFilters })
			});
		} catch (error) {
			console.error('Impossible d’enregistrer les filtres en base:', error);
		}
	};

	const navigateWithCurrentFilters = (page = 1) => {
		const params = buildPublicGamesListSearchParams({
			query: query.trim(),
			sort,
			page,
			filters: filterGroupsToSelections(filterGroups)
		});
		const search = params.toString();
		if (search) {
			void goto(resolve(`/games?${search}`), {
				keepFocus: true,
				noScroll: false
			});
			return;
		}
		void goto(resolve('/games'), {
			keepFocus: true,
			noScroll: false
		});
	};

	const handleReset = () => {
		query = '';
		sort = 'updated_desc';
		filterGroups = createDefaultGamesFilterGroups(translatorIds);
		filterRemoveIndex = null;
		void goto(resolve('/games'), { keepFocus: true });
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
		sort = (preset.sort as PublicGamesSort) || 'updated_desc';
		filterGroups = cloneFilterGroups(preset.groups);
		navigateWithCurrentFilters(1);
	};

	const handleSavedAdd = () => {
		filterRemoveIndex = null;
		if (savedFilters.length >= MAX_SAVED_GAMES_FILTERS) return;

		savedFilters = [
			...savedFilters,
			{
				query: query.trim(),
				sort,
				groups: cloneFilterGroups(filterGroups)
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
		PUBLIC_GAMES_SORT_OPTIONS.find((option) => option.value === sort)?.label ?? 'Tri'
	);

	const handleSortSelect = (value: PublicGamesSort) => {
		if (disabled) return;
		sort = value;
	};

	const hasActiveFilters = $derived(
		Boolean(query.trim()) || sort !== 'updated_desc' || hasActiveGamesFilterGroups(filterGroups)
	);
</script>

<div class="flex flex-col gap-4">
	<div class="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
		<span class="text-sm font-medium">Filtrages sauvegardés :</span>
		<div class="flex flex-wrap gap-2">
			{#each savedFilters as preset, index (index)}
				<button
					type="button"
					class="btn btn-circle btn-sm font-bold {filterRemoveIndex === index
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
			{#if savedFilters.length < MAX_SAVED_GAMES_FILTERS}
				<button
					type="button"
					class="btn btn-circle btn-sm btn-primary"
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
				class="input input-bordered w-full input-sm"
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

	<label class="form-control w-full max-w-xs">
		<span class="label py-1">
			<span class="label-text text-xs font-medium">Tri</span>
		</span>
		<div class="dropdown w-full">
			<div
				tabindex={disabled ? -1 : 0}
				role="button"
				class="btn btn-sm w-full justify-between font-normal btn-outline"
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
					{#each PUBLIC_GAMES_SORT_OPTIONS as option (option.value)}
						<li>
							<button
								type="button"
								class={option.value === sort ? 'menu-active font-medium bg-base-300' : ''}
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
</div>
