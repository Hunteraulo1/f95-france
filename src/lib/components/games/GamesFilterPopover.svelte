<script lang="ts">
	import type { GamesFilterGroupState } from '$lib/games/games-filter-config';
	import { gamesFilterGroupSummary, toggleGamesFilterValue } from '$lib/games/games-filter-state';
	import Check from '@lucide/svelte/icons/check';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import Minus from '@lucide/svelte/icons/minus';

	interface Props {
		group: GamesFilterGroupState;
		disabled?: boolean;
		onchange?: (groups: GamesFilterGroupState[]) => void;
		allGroups: GamesFilterGroupState[];
	}

	let { group, disabled = false, onchange, allGroups }: Props = $props();

	const summary = $derived(gamesFilterGroupSummary(group));
	const hasSelection = $derived(group.values.some((v) => v.checked));

	const handleSelect = (value: string) => {
		if (disabled) return;
		const next = toggleGamesFilterValue(allGroups, group.name, value);
		onchange?.(next);
	};
</script>

<div class="dropdown w-full">
	<div
		tabindex="0"
		role="button"
		class="btn w-full justify-between font-normal btn-sm {hasSelection
			? 'btn-primary'
			: 'btn-outline'}"
		class:btn-disabled={disabled}
	>
		<span class="truncate text-left">{summary}</span>
		<ChevronDown class="h-4 w-4 shrink-0 opacity-60" />
	</div>
	<div
		tabindex="0"
		role="menu"
		class="dropdown-content z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-box border border-base-300 bg-base-100 p-1 shadow-lg"
	>
		<ul class="menu w-full p-0">
			{#each group.values as entry (entry.value)}
				<li>
					<button
						type="button"
						class="flex items-center gap-2"
						onclick={() => handleSelect(entry.value)}
					>
						<span class="flex h-4 w-4 shrink-0 items-center justify-center">
							{#if entry.checked}
								{#if entry.inverse}
									<Minus class="h-3.5 w-3.5 text-error" />
								{:else}
									<Check class="h-3.5 w-3.5 text-success" />
								{/if}
							{/if}
						</span>
						<span class="truncate">{entry.label}</span>
					</button>
				</li>
			{/each}
		</ul>
	</div>
</div>
