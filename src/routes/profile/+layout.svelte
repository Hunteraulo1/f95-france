<script lang="ts">
	import { setRoleBadgeStyles } from '$lib/stores';
	import type { LayoutData } from './$types';

	interface Props {
		data: LayoutData;
		children: import('svelte').Snippet;
	}

	let { data, children }: Props = $props();

	$effect(() => {
		setRoleBadgeStyles(data.roleBadgeStyles ?? {});
	});
</script>

{@render children()}
