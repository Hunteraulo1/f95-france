<script lang="ts">
	import { page } from '$app/state';
	import { env } from '$env/dynamic/public';
	import { isAgeVerified, setAgeVerified } from '$lib/age-verification';
	import AgeVerificationModal from '$lib/components/AgeVerificationModal.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import Header from '$lib/components/Header.svelte';
	import { SITE, absoluteUrl, siteOrigin } from '$lib/site';
	import { initializeUserFromLocals } from '$lib/stores';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
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

	let ageCheckReady = $state(false);
	let ageVerified = $state(false);

	$effect(() => {
		if (!ageCheckReady) return;
		document.documentElement.classList.toggle('overflow-hidden', !ageVerified);
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
		ageVerified = isAgeVerified();
		ageCheckReady = true;
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

{#if !ageCheckReady}
	<div class="flex min-h-screen items-center justify-center bg-base-200">
		<div class="flex h-full flex-col items-center justify-center gap-2">
			<LoaderCircle size={40} class="animate-spin" />
			<span class="text-lg font-medium text-base-content/80">Chargement...</span>
		</div>
	</div>
{:else}
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
			{/if}
			<Footer />
		</div>

		{#if !ageVerified}
			<AgeVerificationModal onConfirm={confirmAge} />
		{/if}
	</div>
{/if}
