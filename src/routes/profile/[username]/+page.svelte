<script lang="ts">
	import { resolve } from '$app/paths';
	import ProfileView from '$lib/components/dashboard/ProfileView.svelte';
	import { profilePublicHref } from '$lib/utils/profile-url';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	const translationsHrefForPage = (page: number) => {
		const base = resolve(profilePublicHref(data.profileSlug));
		return page > 1 ? `${base}?page=${page}` : base;
	};

	const editProfileHref = $derived(
		data.isOwnProfile && data.editProfileHref
			? resolve(data.editProfileHref as '/dashboard/profile')
			: null
	);
</script>

<svelte:head>
	<title>{data.user.username} — Profil — F95 France</title>
</svelte:head>

<main class="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-8">
	<ProfileView
		user={data.user}
		profileStats={data.profileStats}
		customProfile={data.customProfile}
		translatorLinks={data.translatorLinks}
		linkedTranslator={data.linkedTranslator}
		translations={data.translations}
		translationsTotal={data.translationsTotal}
		translationsPage={data.translationsPage}
		translationsTotalPages={data.translationsTotalPages}
		{translationsHrefForPage}
		{editProfileHref}
	/>
</main>
