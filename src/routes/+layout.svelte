<script lang="ts">
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import { isAgeVerified, setAgeVerified } from '$lib/age-verification';
	import AgeVerificationModal from '$lib/components/AgeVerificationModal.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import Header from '$lib/components/Header.svelte';
	import { SITE } from '$lib/site';
	import { applyFaviconEnvBadge } from '$lib/site-favicon';
	import { resolveSiteEnvBadge } from '$lib/site-host';
	import { initializeUserFromLocals } from '$lib/stores';
	import {
		applyAppTheme,
		getThemePreference,
		setupSystemThemeListener,
		syncThemePreferenceFromUser,
		themePreference
	} from '$lib/theme';
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
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

	/** Aligné sur le cookie SSR — le localStorage est resynchronisé après hydratation (app.html). */
	let ageVerifiedLocal = $state<boolean | null>(null);
	const bypassVerif = $derived(page.url.searchParams.has('bypassVerif'));
	const ageVerified = $derived(bypassVerif || (ageVerifiedLocal ?? data.ageVerified));

	$effect(() => {
		if (!browser) return;
		document.documentElement.classList.toggle('overflow-hidden', !ageVerified);
		document.documentElement.dataset.ageVerified = ageVerified ? '1' : '0';
		return () => document.documentElement.classList.remove('overflow-hidden');
	});

	$effect(() => {
		if (!browser) return;
		const badge = resolveSiteEnvBadge(page.url.hostname);
		void applyFaviconEnvBadge(badge);
	});

	const origin = $derived(data.origin);
	const ogImage = SITE.ogImageUrl;
	const pageUrl = $derived(origin);
	const isHome = $derived(page.url.pathname === '/');
	const isDashboardRoute = $derived(
		page.url.pathname.startsWith('/dashboard') ||
			page.url.pathname.startsWith('/dashbord') ||
			page.url.pathname.startsWith('/maintenance')
	);

	const confirmAge = () => {
		setAgeVerified();
		ageVerifiedLocal = true;
	};

	let syncedThemeUserId = $state<string | null>(null);

	$effect(() => {
		if (!browser) return;
		const pref = $themePreference;
		if (pref) applyAppTheme(pref);
	});

	$effect(() => {
		if (!browser) return;
		const userId = data.user?.id ?? null;
		if (!userId) {
			if (syncedThemeUserId !== null) {
				syncedThemeUserId = null;
				syncThemePreferenceFromUser(null);
			}
			return;
		}
		if (userId !== syncedThemeUserId) {
			const isAccountSwitch = syncedThemeUserId !== null;
			syncedThemeUserId = userId;
			// Remontage SPA (update()) : ne pas écraser la préférence client déjà choisie.
			if (isAccountSwitch || get(themePreference) === null) {
				syncThemePreferenceFromUser(data.user?.theme);
			}
		}
	});

	onMount(() => {
		if (!ageVerified && isAgeVerified()) {
			setAgeVerified();
			ageVerifiedLocal = true;
		}

		if (get(themePreference) === null) {
			syncThemePreferenceFromUser(data.user?.theme);
		}

		return setupSystemThemeListener(getThemePreference);
	});
</script>

<svelte:head>
	<link rel="icon" href={SITE.faviconUrl} sizes="any" />
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
				<div class="mx-auto w-full" class:max-w-[1536px]={page.url.pathname !== '/'}>
					{@render children()}
				</div>
			</div>
			<Footer />
		{/if}
	</div>

	{#if !ageVerified}
		<AgeVerificationModal onConfirm={confirmAge} />
	{/if}
</div>
