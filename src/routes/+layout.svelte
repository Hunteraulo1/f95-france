<script lang="ts">
	import { env } from '$env/dynamic/public';
	import { SITE, absoluteUrl, siteOrigin } from '$lib/site';
	import { onMount } from 'svelte';
	import { themeChange } from 'theme-change';
	import '../app.css';

	let { children } = $props();

	const origin = $derived(siteOrigin(env.PUBLIC_APP_ORIGIN));
	const ogImage = $derived(absoluteUrl(SITE.ogImagePath, env.PUBLIC_APP_ORIGIN));
	const pageUrl = $derived(origin);

	onMount(() => {
		themeChange(false);
	});
</script>

<svelte:head>
	<link rel="icon" href="/favicon.ico" />
	<link rel="sitemap" type="application/xml" title="Sitemap" href="/sitemap.xml" />
	<title>{SITE.name}</title>
	<meta name="description" content={SITE.description} />
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content={SITE.name} />
	<meta property="og:title" content={SITE.name} />
	<meta property="og:description" content={SITE.description} />
	<meta property="og:url" content={pageUrl} />
	<meta property="og:image" content={ogImage} />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={SITE.name} />
	<meta name="twitter:description" content={SITE.description} />
	<meta name="twitter:image" content={ogImage} />
</svelte:head>

{@render children()}
