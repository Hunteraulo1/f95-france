<script lang="ts">
	import Profile from '$lib/components/dashboard/Profile.svelte';
	import { user } from '$lib/stores';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();
</script>

<Profile user={$user} email={$user?.email} stats={data.stats} />
