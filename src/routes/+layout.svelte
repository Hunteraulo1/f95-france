<script lang="ts">
	import { onMount } from 'svelte';
	import { themeChange } from 'theme-change';
	import '../app.css';

	import { dev } from '$app/environment';
	import { injectAnalytics } from '@vercel/analytics/sveltekit';
	import { injectSpeedInsights } from '@vercel/speed-insights/sveltekit';

	let { children } = $props();

	onMount(() => {
		themeChange(false);
	});

	injectAnalytics({ mode: dev ? 'development' : 'production' });
	injectSpeedInsights();
</script>

<svelte:head>
	<link rel="icon" href="/favicon.svg" />
</svelte:head>

{@render children()}
