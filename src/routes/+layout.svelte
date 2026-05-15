<script lang="ts">
	import { onMount } from 'svelte';
	import { themeChange } from 'theme-change';
	import '../app.css';

	let { children } = $props();

	onMount(() => {
		themeChange(false);
	});
</script>

<svelte:head>
	<link rel="icon" href="/favicon.ico" />
	<title>F95 France</title>
  <script defer src="https://insight.f95france.site/script.js" data-website-id="7ba03446-3038-498c-be20-4c482a1cc3f1"></script>
</svelte:head>

{@render children()}
