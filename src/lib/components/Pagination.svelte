<script lang="ts">
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';

	type Props = {
		/** Page courante (1-based) */
		currentPage: number;
		totalPages: number;
		totalCount: number;
		/** Construit l’URL (idéalement via `resolve()` côté parent) pour un numéro de page */
		hrefForPage: (page: number) => string;
		/** Mot utilisé après le total, ex. « résultat » → « 3 résultats » */
		countLabel?: string;
	};

	let {
		currentPage,
		totalPages,
		totalCount,
		hrefForPage,
		countLabel = 'résultat'
	}: Props = $props();

	const visiblePages = $derived.by(() => {
		const pages: (number | 'ellipsis')[] = [];
		const total = totalPages;
		const cur = currentPage;
		if (total <= 7) {
			for (let i = 1; i <= total; i++) pages.push(i);
			return pages;
		}
		pages.push(1);
		if (cur > 3) pages.push('ellipsis');
		for (let i = Math.max(2, cur - 1); i <= Math.min(total - 1, cur + 1); i++) pages.push(i);
		if (cur < total - 2) pages.push('ellipsis');
		pages.push(total);
		return pages;
	});
</script>

{#if totalPages > 1}
	<div class="flex flex-wrap items-center justify-between gap-2">
		<p class="text-sm text-base-content/70">
			Page <strong>{currentPage}</strong> sur <strong>{totalPages}</strong>
			· {totalCount}
			{countLabel}{totalCount > 1 ? 's' : ''}
		</p>
		<div class="join">
			<a
				class="btn join-item btn-sm"
				class:btn-disabled={currentPage <= 1}
				aria-label="Page précédente"
				href={hrefForPage(Math.max(1, currentPage - 1))}
			>
				<ChevronLeft size={16} />
			</a>
			{#each visiblePages as p, i (i)}
				{#if p === 'ellipsis'}
					<span class="btn btn-disabled join-item btn-sm">…</span>
				{:else}
					<a
						class="btn join-item btn-sm {p === currentPage
							? 'btn-outline btn-primary'
							: 'btn-ghost'}"
						href={hrefForPage(p)}
					>
						{p}
					</a>
				{/if}
			{/each}
			<a
				class="btn join-item btn-sm"
				class:btn-disabled={currentPage >= totalPages}
				aria-label="Page suivante"
				href={hrefForPage(Math.min(totalPages, currentPage + 1))}
			>
				<ChevronRight size={16} />
			</a>
		</div>
	</div>
{/if}
