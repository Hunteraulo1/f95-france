<script lang="ts">
	import Profile from '$lib/components/dashboard/Profile.svelte';
	import { user } from '$lib/stores';
</script>

<Profile user={$user} email={$user?.email} />
