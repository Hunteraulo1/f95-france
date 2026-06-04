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
		/** Mot au singulier après le total, ex. « jeu » */
		countLabel?: string;
		/** Pluriel si différent de « {countLabel}s » (ex. jeu → jeux, mise à jour → mises à jour) */
		countLabelPlural?: string;
	};

	let {
		currentPage,
		totalPages,
		totalCount,
		hrefForPage,
		countLabel = 'résultat',
		countLabelPlural
	}: Props = $props();

	const displayCountLabel = $derived(
		totalCount > 1 ? (countLabelPlural ?? `${countLabel}s`) : countLabel
	);

	type PageItem = { kind: 'page'; page: number } | { kind: 'ellipsis'; page: number };

	/** Page au milieu de la plage masquée (entre 1 et la fenêtre courante, ou entre fenêtre et la fin). */
	const ellipsisJumpPage = (position: 'start' | 'end', cur: number, total: number) => {
		if (position === 'start') {
			return Math.max(2, Math.round((1 + (cur - 1)) / 2));
		}
		return Math.min(total - 1, Math.round((cur + 1 + total) / 2));
	};

	const visiblePages = $derived.by((): PageItem[] => {
		const items: PageItem[] = [];
		const total = totalPages;
		const cur = currentPage;
		if (total <= 7) {
			for (let i = 1; i <= total; i++) items.push({ kind: 'page', page: i });
			return items;
		}
		items.push({ kind: 'page', page: 1 });
		if (cur > 3) items.push({ kind: 'ellipsis', page: ellipsisJumpPage('start', cur, total) });
		for (let i = Math.max(2, cur - 1); i <= Math.min(total - 1, cur + 1); i++) {
			items.push({ kind: 'page', page: i });
		}
		if (cur < total - 2) items.push({ kind: 'ellipsis', page: ellipsisJumpPage('end', cur, total) });
		items.push({ kind: 'page', page: total });
		return items;
	});
</script>

{#if totalPages > 1}
	<div class="flex flex-wrap items-center justify-between gap-2">
		<p class="text-sm text-base-content/70">
			Page <strong>{currentPage}</strong> sur <strong>{totalPages}</strong>
			· {totalCount}
			{displayCountLabel}
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
			{#each visiblePages as item, i (`${item.kind}-${item.page}-${i}`)}
				{#if item.kind === 'ellipsis'}
					<a
						class="btn btn-ghost join-item btn-sm"
						href={hrefForPage(item.page)}
						aria-label={`Aller à la page ${item.page}`}
						title={`Page ${item.page}`}
					>
						…
					</a>
				{:else}
					<a
						class="btn join-item btn-sm {item.page === currentPage
							? 'btn-outline btn-primary'
							: 'btn-ghost'}"
						href={hrefForPage(item.page)}
					>
						{item.page}
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
