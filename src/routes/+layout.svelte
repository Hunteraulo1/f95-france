<script lang="ts">
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import { env } from '$env/dynamic/public';
	import { setAgeVerified } from '$lib/age-verification';
	import AgeVerificationModal from '$lib/components/AgeVerificationModal.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import Header from '$lib/components/Header.svelte';
	import { SITE, absoluteUrl, siteOrigin } from '$lib/site';
	import { initializeUserFromLocals } from '$lib/stores';
	import { onMount } from 'svelte';
	import { themeChange } from 'theme-change';
	import '../app.css';
	import type { LayoutData } from './$types';

	interface Props {
		data: LayoutData;
		children: import('svelte').Snippet;
	}

	let { data, children }: Props = $props();

	$effect(() => {
		initializeUserFromLocals(data.user);
	});

	const readInitialAgeVerified = () =>
		browser ? document.documentElement.dataset.ageVerified === '1' : false;

	let ageVerified = $state(readInitialAgeVerified());

	$effect(() => {
		if (!browser) return;
		document.documentElement.classList.toggle('overflow-hidden', !ageVerified);
		document.documentElement.dataset.ageVerified = ageVerified ? '1' : '0';
		return () => document.documentElement.classList.remove('overflow-hidden');
	});

	const origin = $derived(siteOrigin(env.PUBLIC_APP_ORIGIN));
	const ogImage = $derived(absoluteUrl(SITE.ogImagePath, env.PUBLIC_APP_ORIGIN));
	const pageUrl = $derived(origin);
	const isHome = $derived(page.url.pathname === '/');
	const isDashboardRoute = $derived(
		page.url.pathname.startsWith('/dashboard') || page.url.pathname.startsWith('/dashbord')
	);

	const confirmAge = () => {
		setAgeVerified();
		ageVerified = true;
	};

	onMount(() => {
		const run = () => themeChange(false);
		if ('requestIdleCallback' in window) {
			requestIdleCallback(run, { timeout: 2000 });
		} else {
			setTimeout(run, 0);
		}
	});
</script>

<svelte:head>
	<link rel="icon" href="/favicon.ico" sizes="any" />
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

<div class="relative min-h-screen">
	<div
		class:pointer-events-none={!ageVerified}
		class:select-none={!ageVerified}
		inert={!ageVerified}
	>
		{#if isDashboardRoute}
			{@render children()}
		{:else}
			<div class="flex min-h-screen flex-col bg-base-200">
				{#if !isHome}
					<Header />
				{/if}
				{@render children()}
			</div>
			<Footer />
		{/if}
	</div>

	{#if !ageVerified}
		<AgeVerificationModal onConfirm={confirmAge} />
	{/if}
</div>
