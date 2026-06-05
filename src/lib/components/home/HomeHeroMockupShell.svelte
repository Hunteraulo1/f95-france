<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		badge: string;
		children: Snippet;
	}

	let { badge, children }: Props = $props();
</script>

<div
	class="hero-mockup-shell relative flex h-full min-h-0 w-full flex-col gap-[0.55rem] rounded-2xl border border-base-content/20 bg-base-100/85 p-4 shadow-[0_25px_50px_-12px_color-mix(in_oklab,var(--color-neutral)_45%,transparent),inset_0_1px_0_color-mix(in_oklab,white_40%,transparent)]"
>
	<div class="flex shrink-0 items-center px-0.5 pb-1 pt-0.5">
		<span class="badge badge-primary badge-outline">{badge}</span>
	</div>
	<div class="min-h-0 flex-1 overflow-hidden">
		{@render children()}
	</div>
</div>
