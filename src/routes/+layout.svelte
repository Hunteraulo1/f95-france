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
</svelte:head>

{@render children()}
