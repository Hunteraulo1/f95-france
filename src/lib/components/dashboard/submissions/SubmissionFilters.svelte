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
		acceptedCount: number;
		rejectedCount: number;
		onFilterChange: (status: string) => void;
	}

	let { currentFilter, pendingCount, acceptedCount, rejectedCount, onFilterChange }: Props = $props();

	const filters: FilterConfig[] = [
		{
			value: 'pending',
			label: 'En attente',
			count: pendingCount,
			badgeClass: 'badge-warning'
		},
		{
			value: 'accepted',
			label: 'Acceptées',
			count: acceptedCount,
			badgeClass: 'badge-success'
		},
		{
			value: 'rejected',
			label: 'Refusées',
			count: rejectedCount,
			badgeClass: 'badge-error'
		},
		{
			value: 'all',
			label: 'Toutes',
			count: 0,
			badgeClass: ''
		}
	];
</script>

<div class="flex gap-2">
	{#each filters as filter (filter.value)}
		<button
			class="btn btn-sm"
			class:btn-active={currentFilter === filter.value}
			onclick={() => onFilterChange(filter.value)}
		>
			{filter.label}
			{#if filter.count > 0}
				<div class="ml-2 badge badge-sm {filter.badgeClass}">{filter.count}</div>
			{/if}
		</button>
	{/each}
</div>
