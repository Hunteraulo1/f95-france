<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import { onMount } from 'svelte';
	import { themeChange } from 'theme-change';
	import '../app.css';
	import type { LayoutServerData } from './$types';

  let { children, data }: { children: any; data: LayoutServerData } = $props();

  onMount(() => {
    themeChange(false)
  })
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children?.()}
