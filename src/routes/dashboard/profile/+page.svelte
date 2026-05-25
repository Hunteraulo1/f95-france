<script lang="ts">
	import Profile from '$lib/components/dashboard/Profile.svelte';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();
</script>

<Profile
	user={data.user}
	email={data.user?.email}
	stats={data.stats}
	customProfile={data.customProfile}
	translatorLinks={data.translatorLinks}
	linkedTranslator={data.linkedTranslator}
	translations={data.translations}
	translationsTotal={data.translationsTotal}
	allTranslationsHref={data.allTranslationsHref}
	canCustomizeProfile={data.canCustomizeProfile}
/>
