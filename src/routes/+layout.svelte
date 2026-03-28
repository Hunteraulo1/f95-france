<script lang="ts">
	import { onMount } from 'svelte';
	import { themeChange } from 'theme-change';
	import '../app.css';

  import { dev } from '$app/environment';
  import { injectAnalytics } from '@vercel/analytics/sveltekit';

	let { children } = $props();

	onMount(() => {
		themeChange(false);
	});

  injectAnalytics({ mode: dev ? 'development' : 'production' });
</script>

<svelte:head>
	<link rel="icon" href="/favicon.svg" />
</svelte:head>

{@render children()}
