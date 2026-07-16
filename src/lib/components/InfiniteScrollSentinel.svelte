<script lang="ts">
	interface Props {
		loading?: boolean;
		hasMore?: boolean;
		error?: string | null;
		onLoadMore: () => void | Promise<void>;
	}

	let { loading = false, hasMore = false, error = null, onLoadMore }: Props = $props();

	let sentinel = $state<HTMLElement | null>(null);

	function findScrollRoot(el: HTMLElement): Element | null {
		let node: HTMLElement | null = el.parentElement;
		while (node) {
			const { overflowY } = getComputedStyle(node);
			if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') {
				return node;
			}
			node = node.parentElement;
		}
		return null;
	}

	$effect(() => {
		const el = sentinel;
		if (!el) return;

		const root = findScrollRoot(el);
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) void onLoadMore();
			},
			{ root, rootMargin: '280px' }
		);
		observer.observe(el);
		return () => observer.disconnect();
	});
</script>

{#if hasMore || loading || error}
	<div bind:this={sentinel} class="flex flex-col items-center gap-2 py-6">
		{#if loading}
			<span class="loading loading-md loading-spinner text-primary" aria-label="Chargement"></span>
		{:else if error}
			<p class="text-sm text-error">{error}</p>
			<button type="button" class="btn btn-outline btn-sm" onclick={() => onLoadMore()}>
				Réessayer
			</button>
		{:else if hasMore}
			<p class="text-sm text-base-content/50">Faites défiler pour charger la suite…</p>
		{/if}
	</div>
{/if}
