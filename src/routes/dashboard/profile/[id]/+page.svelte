<script lang="ts">
	import { resolve } from '$app/paths';
	import ProfileView from '#lib/components/dashboard/ProfileView.svelte';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	const translationsApiPath = $derived(
		resolve('/dashboard/profile/[id]/translations', { id: data.profileSlug })
	);

	const editProfileHref = $derived(
		data.isOwnProfile && data.editProfileHref
			? resolve(data.editProfileHref as '/dashboard/profile')
			: null
	);
</script>

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
	{translationsApiPath}
	{editProfileHref}
	musicUrl={data.customProfile?.musicUrl ?? data.user.profileMusicUrl}
/>
