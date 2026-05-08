<script lang="ts">
	interface FilterConfig {
		value: string;
		label: string;
		count: number;
		badgeClass: string;
	}

	interface Props {
		currentFilter: string;
		pendingCount: number;
		openedCount: number;
		acceptedCount: number;
		rejectedCount: number;
		toFixCount: number;
		onFilterChange: (status: string) => void;
	}

	let {
		currentFilter,
		pendingCount,
		openedCount,
		acceptedCount,
		rejectedCount,
		toFixCount,
		onFilterChange
	}: Props = $props();

	const filters = $derived.by((): FilterConfig[] => {
		const n = (v: number) => Number(v) || 0;
		const p = n(pendingCount);
		const o = n(openedCount);
		const a = n(acceptedCount);
		const r = n(rejectedCount);
		const f = n(toFixCount);
		const allTotal = p + o + a + r + f;
		return [
			{
				value: 'pending',
				label: 'En attente',
				count: p,
				badgeClass: 'badge-warning'
			},
			{
				value: 'to_fix',
				label: 'À corriger',
				count: f,
				badgeClass: 'badge-secondary'
			},
			{
				value: 'opened',
				label: 'Ouvertes',
				count: o,
				badgeClass: 'badge-info'
			},
			{
				value: 'accepted',
				label: 'Acceptées',
				count: a,
				badgeClass: 'badge-success'
			},
			{
				value: 'rejected',
				label: 'Refusées',
				count: r,
				badgeClass: 'badge-error'
			},
			{
				value: 'all',
				label: 'Toutes',
				count: allTotal,
				badgeClass: 'badge-neutral'
			}
		];
	});
</script>

<div class="flex flex-wrap gap-2" role="tablist" aria-label="Filtrer par statut">
	{#each filters as filter (filter.value)}
		<button
			type="button"
			role="tab"
			aria-selected={currentFilter === filter.value}
			class="btn btn-sm {currentFilter === filter.value ? 'btn-primary' : 'btn-ghost'}"
			onclick={() => onFilterChange(filter.value)}
		>
			{filter.label}
			{#if filter.count > 0}
				<span class="ml-2 badge badge-sm {filter.badgeClass}">{filter.count}</span>
			{/if}
		</button>
	{/each}
</div>
