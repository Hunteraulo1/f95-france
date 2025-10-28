<script lang="ts">
	import Profile from '$lib/components/dashboard/Profile.svelte';
	import type { PageData } from './$types';
  interface Props {
    data: PageData
  }

  let { data }: Props = $props();
</script>

<Profile user={data.user} />
