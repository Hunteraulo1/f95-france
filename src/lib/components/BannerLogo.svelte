<script lang="ts">
	import { SITE } from '$lib/site';

	interface Props {
		class?: string;
	}

	let { class: className = 'h-10 w-auto' }: Props = $props();
</script>

<div class="select-none {className}" role="img" aria-label="Bannière de F95 France">
	<img
		src={SITE.bannerLogoLightUrl}
		alt=""
		class="block h-full w-auto object-contain [html[data-theme=dark]_&]:hidden"
		width="1920"
		height="231"
		decoding="async"
		fetchpriority="high"
		draggable="false"
	/>
	<img
		src={SITE.bannerLogoDarkUrl}
		alt=""
		class="hidden h-full w-auto object-contain [html[data-theme=dark]_&]:block"
		width="1920"
		height="231"
		decoding="async"
		fetchpriority="high"
		draggable="false"
	/>
</div>
