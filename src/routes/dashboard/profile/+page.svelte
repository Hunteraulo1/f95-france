<script lang="ts">
	import { resolve } from '$app/paths';
	import Profile from '$lib/components/dashboard/Profile.svelte';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	const translationsHrefForPage = (page: number) => {
		const base = resolve('/dashboard/profile');
		return page > 1 ? `${base}?page=${page}` : base;
	};
</script>

<Profile
	user={data.user}
	email={data.user?.email}
	profileStats={data.profileStats}
	customProfile={data.customProfile}
	translatorLinks={data.translatorLinks}
	linkedTranslator={data.linkedTranslator}
	translations={data.translations}
	translationsTotal={data.translationsTotal}
	translationsPage={data.translationsPage}
	translationsTotalPages={data.translationsTotalPages}
	{translationsHrefForPage}
	canCustomizeProfile={data.canCustomizeProfile}
/>
