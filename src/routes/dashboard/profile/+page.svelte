<script lang="ts">
	import { resolve } from '$app/paths';
	import ProfileEdit from '$lib/components/dashboard/ProfileEdit.svelte';
	import { profilePublicHref } from '$lib/utils/profile-url';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();
</script>

<ProfileEdit
	username={data.user.username}
	avatar={data.user.avatar ?? ''}
	publicProfileHref={resolve(profilePublicHref(data.user.username))}
	profileCustomize={data.profileCustomize}
	customProfile={data.customProfile}
	linkedTranslator={data.linkedTranslator}
	translatorPagesWriteMode={data.translatorPagesWriteMode}
	roleEditMode={data.roleEditMode}
	directMode={data.directMode}
/>
