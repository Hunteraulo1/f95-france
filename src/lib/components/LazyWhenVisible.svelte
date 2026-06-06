<script lang="ts">
	import type { Snippet } from 'svelte';
	import { onMount } from 'svelte';

	interface Props {
		children: Snippet;
		/** Marge autour du viewport pour déclencher le chargement avant l’affichage. */
		rootMargin?: string;
		class?: string;
	}

	let { children, rootMargin = '300px', class: className = '' }: Props = $props();

	let visible = $state(false);
	let container: HTMLElement | undefined = $state();

	onMount(() => {
		if (!container) return;

		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry?.isIntersecting) {
					visible = true;
					observer.disconnect();
				}
			},
			{ rootMargin }
		);

		observer.observe(container);
		return () => observer.disconnect();
	});
</script>

<div bind:this={container} class={className}>
	{#if visible}
		{@render children()}
	{/if}
</div>
