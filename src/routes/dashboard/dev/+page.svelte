<script lang="ts">
	import DevDiscordWebhookCard from '$lib/components/dashboard/dev/DevDiscordWebhookCard.svelte';
	import DevF95ScrapeCard from '$lib/components/dashboard/dev/DevF95ScrapeCard.svelte';
	import DevGoogleSheetsCard from '$lib/components/dashboard/dev/DevGoogleSheetsCard.svelte';
	import DevLegacyApiSyncCard from '$lib/components/dashboard/dev/DevLegacyApiSyncCard.svelte';
	import type { ConfigClientSafe } from '$lib/server/app-config';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const config = $derived(data.config as ConfigClientSafe | null | undefined);
	const webhookStatus = $derived(
		data.webhookStatus ?? { updates: false, translators: false, admin: false }
	);
</script>

<div class="container flex flex-col gap-6">
	<h1 class="mb-6 text-3xl font-bold text-base-content">Page de développement</h1>

	<DevGoogleSheetsCard {config} />
	<DevDiscordWebhookCard {webhookStatus} />
	<DevF95ScrapeCard />
	<DevLegacyApiSyncCard />
</div>
