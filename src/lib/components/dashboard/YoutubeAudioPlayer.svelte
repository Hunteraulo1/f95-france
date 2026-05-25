<script lang="ts">
	import Pause from '@lucide/svelte/icons/pause';
	import Play from '@lucide/svelte/icons/play';
	import { onMount } from 'svelte';

	interface Props {
		videoId: string;
	}

	let { videoId }: Props = $props();

	let playerHost = $state<HTMLDivElement | null>(null);
	let player = $state<YTPlayer | null>(null);
	let ready = $state(false);
	let playing = $state(false);
	let loadError = $state<string | null>(null);

	const elementId = $derived(`yt-audio-${videoId}`);

	function loadYoutubeIframeApi(): Promise<void> {
		if (typeof window === 'undefined') return Promise.resolve();
		if (window.YT?.Player) return Promise.resolve();

		return new Promise((resolve) => {
			const previous = window.onYouTubeIframeAPIReady;
			window.onYouTubeIframeAPIReady = () => {
				previous?.();
				resolve();
			};

			if (!document.querySelector('script[data-yt-iframe-api]')) {
				const script = document.createElement('script');
				script.src = 'https://www.youtube.com/iframe_api';
				script.async = true;
				script.dataset.ytIframeApi = '1';
				document.head.appendChild(script);
			}
		});
	}

	function initPlayer() {
		if (!playerHost || !window.YT?.Player) return;

		player = new window.YT.Player(elementId, {
			height: 1,
			width: 1,
			videoId,
			playerVars: {
				autoplay: 1,
				controls: 0,
				disablekb: 1,
				fs: 0,
				iv_load_policy: 3,
				modestbranding: 1,
				rel: 0,
				playsinline: 1
			},
			events: {
				onReady: (event) => {
					ready = true;
					try {
						event.target.playVideo();
						playing = true;
					} catch {
						/* Le navigateur peut bloquer l’autoplay avec son ; le bouton Écouter reste disponible. */
					}
				},
				onStateChange: (event) => {
					const YT = window.YT;
					if (!YT) return;
					playing = event.data === YT.PlayerState.PLAYING;
					if (event.data === YT.PlayerState.ENDED) {
						playing = false;
					}
				},
				onError: () => {
					loadError = 'Impossible de lire ce morceau (restriction ou lien invalide).';
					ready = false;
				}
			}
		});
	}

	onMount(() => {
		let cancelled = false;

		void loadYoutubeIframeApi().then(() => {
			if (cancelled) return;
			initPlayer();
		});

		return () => {
			cancelled = true;
			try {
				player?.destroy();
			} catch {
				/* ignore */
			}
			player = null;
		};
	});

	const togglePlayback = () => {
		if (!player || !ready || loadError) return;
		if (playing) player.pauseVideo();
		else player.playVideo();
	};
</script>

<div class="flex flex-col gap-2">
	<div class="flex flex-wrap items-center gap-3">
		<div class="yt-audio-player-host" bind:this={playerHost} aria-hidden="true">
			<div id={elementId}></div>
		</div>

		<button
			type="button"
			class="btn btn-sm btn-outline gap-2"
			disabled={!ready || !!loadError}
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
</style>
