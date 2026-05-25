<script lang="ts">
	import {
		buildYoutubeAudioEmbedUrl,
		isYoutubeEmbedPostMessageOrigin
	} from '$lib/profile/youtube-music';
	import Pause from '@lucide/svelte/icons/pause';
	import Play from '@lucide/svelte/icons/play';
	import { onMount } from 'svelte';

	interface Props {
		videoId: string;
	}

	let { videoId }: Props = $props();

	let iframeEl = $state<HTMLIFrameElement | null>(null);
	let embedSrc = $state('');
	let ready = $state(false);
	let playing = $state(false);
	let loadError = $state<string | null>(null);

	const YT_ENDED = 0;
	const YT_PLAYING = 1;

	function postCommand(func: 'playVideo' | 'pauseVideo') {
		if (!iframeEl?.contentWindow) return;
		for (const target of ['https://www.youtube-nocookie.com', 'https://www.youtube.com'] as const) {
			iframeEl.contentWindow.postMessage(
				JSON.stringify({ event: 'command', func, args: '' }),
				target
			);
		}
	}

	function handleEmbedMessage(event: MessageEvent) {
		if (!isYoutubeEmbedPostMessageOrigin(event.origin)) return;

		let data: { event?: string; info?: number | { playerState?: number } } | null = null;
		try {
			data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
		} catch {
			return;
		}
		if (!data || typeof data !== 'object') return;

		if (data.event === 'onReady') {
			ready = true;
			playing = true;
			return;
		}

		if (data.event === 'onStateChange' && typeof data.info === 'number') {
			ready = true;
			playing = data.info === YT_PLAYING;
			if (data.info === YT_ENDED) playing = false;
			return;
		}

		if (
			data.event === 'infoDelivery' &&
			data.info &&
			typeof data.info === 'object' &&
			typeof data.info.playerState === 'number'
		) {
			ready = true;
			playing = data.info.playerState === YT_PLAYING;
			if (data.info.playerState === YT_ENDED) playing = false;
		}
	}

	onMount(() => {
		embedSrc = buildYoutubeAudioEmbedUrl(videoId, window.location.origin);
		window.addEventListener('message', handleEmbedMessage);

		return () => {
			window.removeEventListener('message', handleEmbedMessage);
		};
	});

	const togglePlayback = () => {
		if (!ready || loadError) return;
		if (playing) postCommand('pauseVideo');
		else postCommand('playVideo');
	};
</script>

<div class="flex flex-col gap-2">
	<div class="flex flex-wrap items-center gap-3">
		<div class="yt-audio-player-host" aria-hidden="true">
			{#if embedSrc}
				<iframe
					bind:this={iframeEl}
					title="Lecteur YouTube"
					src={embedSrc}
					allow="autoplay; encrypted-media"
					referrerpolicy="strict-origin-when-cross-origin"
					onload={() => {
						ready = true;
						postCommand('playVideo');
					}}
				></iframe>
			{/if}
		</div>

		<button
			type="button"
			class="btn btn-sm btn-outline gap-2"
			disabled={!embedSrc || !!loadError}
			aria-pressed={playing}
			onclick={togglePlayback}
		>
			{#if playing}
				<Pause class="h-4 w-4" aria-hidden="true" />
				Pause
			{:else}
				<Play class="h-4 w-4" aria-hidden="true" />
				Écouter
			{/if}
		</button>
	</div>

	{#if loadError}
		<p class="text-sm text-warning">{loadError}</p>
	{/if}
</div>

<style>
	.yt-audio-player-host {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	.yt-audio-player-host iframe {
		width: 1px;
		height: 1px;
		border: 0;
	}
</style>
