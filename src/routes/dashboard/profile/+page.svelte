<script lang="ts">
	import { resolve } from '$app/paths';
	import ProfileEdit from '$lib/components/dashboard/ProfileEdit.svelte';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();
</script>

<ProfileEdit
	username={data.user.username}
	publicProfileHref={resolve(`/dashboard/profile/${data.user.id}`)}
	profileCustomize={data.profileCustomize}
	customProfile={data.customProfile}
	linkedTranslator={data.linkedTranslator}
/>
