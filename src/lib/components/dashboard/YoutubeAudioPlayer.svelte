<script lang="ts">
	import {
		buildYoutubeAudioEmbedUrl,
		isYoutubeEmbedPostMessageOrigin,
		YOUTUBE_EMBED_WIDGET_ID
	} from '$lib/profile/youtube-music';
	import Pause from '@lucide/svelte/icons/pause';
	import Play from '@lucide/svelte/icons/play';
	import Volume2 from '@lucide/svelte/icons/volume-2';
	import VolumeX from '@lucide/svelte/icons/volume-x';
	import { onMount } from 'svelte';

	interface Props {
		videoId: string;
	}

	let { videoId }: Props = $props();

	const VOLUME_STORAGE_KEY = 'f95-profile-yt-volume';
	const DEFAULT_VOLUME = 70;

	let iframeEl = $state<HTMLIFrameElement | null>(null);
	let embedSrc = $state('');
	let ready = $state(false);
	let playing = $state(false);
	let pendingPlay = $state(false);
	let volume = $state(DEFAULT_VOLUME);
	let volumeBeforeMute = $state(DEFAULT_VOLUME);
	let loadError = $state<string | null>(null);

	const YT_ENDED = 0;
	const YT_PLAYING = 1;
	const YT_PAUSED = 2;

	const EMBED_TARGETS = ['https://www.youtube-nocookie.com', 'https://www.youtube.com'] as const;

	type YtCommandFunc = 'playVideo' | 'pauseVideo' | 'setVolume' | 'mute' | 'unMute';

	function readStoredVolume(): number {
		try {
			const raw = localStorage.getItem(VOLUME_STORAGE_KEY);
			if (raw == null) return DEFAULT_VOLUME;
			const n = Number.parseInt(raw, 10);
			return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : DEFAULT_VOLUME;
		} catch {
			return DEFAULT_VOLUME;
		}
	}

	function persistVolume(value: number) {
		try {
			localStorage.setItem(VOLUME_STORAGE_KEY, String(value));
		} catch {
			/* quota / mode privé */
		}
	}

	function postToEmbed(message: Record<string, unknown>) {
		if (!iframeEl?.contentWindow) return;
		const body = JSON.stringify(message);
		for (const target of EMBED_TARGETS) {
			iframeEl.contentWindow.postMessage(body, target);
		}
	}

	function postCommand(func: 'playVideo' | 'pauseVideo' | 'mute' | 'unMute') {
		postToEmbed({ event: 'command', func, args: '' });
	}

	function postSetVolume(level: number) {
		postToEmbed({ event: 'command', func: 'setVolume', args: [level] });
	}

	function subscribeEmbed() {
		postToEmbed({ event: 'listening', id: YOUTUBE_EMBED_WIDGET_ID, channel: 'widget' });
	}

	function scheduleEmbedSubscription() {
		subscribeEmbed();
		for (const delay of [100, 300, 800, 1500]) {
			window.setTimeout(subscribeEmbed, delay);
		}
	}

	function applyVolumeToPlayer(level: number) {
		if (!ready) return;
		const clamped = Math.round(Math.max(0, Math.min(100, level)));
		if (clamped === 0) {
			postCommand('mute');
		} else {
			postCommand('unMute');
			postSetVolume(clamped);
		}
	}

	function setVolumeLevel(level: number) {
		const clamped = Math.round(Math.max(0, Math.min(100, level)));
		volume = clamped;
		if (clamped > 0) volumeBeforeMute = clamped;
		persistVolume(clamped);
		applyVolumeToPlayer(clamped);
	}

	function requestPlay() {
		pendingPlay = true;
		playing = true;
		scheduleEmbedSubscription();
		postCommand('playVideo');
	}

	function handleEmbedMessage(event: MessageEvent) {
		if (!isYoutubeEmbedPostMessageOrigin(event.origin)) return;
		if (iframeEl && event.source !== iframeEl.contentWindow) return;

		try {
			const data: { event?: string; info?: number | { playerState?: number } } =
				typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
			if (!data || typeof data !== 'object') return;

			if (data.event === 'onReady') {
				ready = true;
				loadError = null;
				applyVolumeToPlayer(volume);
				if (pendingPlay) {
					postCommand('playVideo');
				}
				return;
			}

			if (data.event === 'onStateChange' && typeof data.info === 'number') {
				ready = true;
				loadError = null;
				playing = data.info === YT_PLAYING;
				if (data.info === YT_ENDED || data.info === YT_PAUSED) playing = false;
				return;
			}

			if (
				data.event === 'infoDelivery' &&
				data.info &&
				typeof data.info === 'object' &&
				typeof data.info.playerState === 'number'
			) {
				ready = true;
				loadError = null;
				const state = data.info.playerState;
				playing = state === YT_PLAYING;
				if (state === YT_ENDED || state === YT_PAUSED) playing = false;
			}
		} catch {
			/* message non JSON ou format inconnu */
		}
	}

	onMount(() => {
		const stored = readStoredVolume();
		volume = stored;
		volumeBeforeMute = stored > 0 ? stored : DEFAULT_VOLUME;
		embedSrc = buildYoutubeAudioEmbedUrl(videoId, window.location.origin);
		window.addEventListener('message', handleEmbedMessage);

		return () => {
			window.removeEventListener('message', handleEmbedMessage);
		};
	});

	const togglePlayback = () => {
		if (loadError) return;

		if (playing) {
			pendingPlay = false;
			playing = false;
			if (ready) postCommand('pauseVideo');
			return;
		}

		requestPlay();
	};

	const toggleMute = () => {
		setVolumeLevel(volume > 0 ? 0 : volumeBeforeMute);
	};
</script>

<div class="flex flex-col gap-2">
	<div class="relative flex flex-wrap items-center gap-3">
		<div class="yt-audio-player-host" aria-hidden="true">
			{#if embedSrc}
				<iframe
					bind:this={iframeEl}
					title="Lecteur YouTube"
					src={embedSrc}
					referrerpolicy="strict-origin-when-cross-origin"
					onload={() => {
						scheduleEmbedSubscription();
					}}
				></iframe>
			{/if}
		</div>

		<button
			type="button"
			class="btn btn-sm btn-outline gap-2"
			disabled={!!loadError}
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

		<div class="dropdown dropdown-end">
			<button
				type="button"
				tabindex="0"
				class="btn btn-sm btn-outline btn-square"
				disabled={!!loadError}
				aria-label="Régler le volume ({volume} %)"
			>
				{#if volume === 0}
					<VolumeX class="h-4 w-4" aria-hidden="true" />
				{:else}
					<Volume2 class="h-4 w-4" aria-hidden="true" />
				{/if}
			</button>
			<div
				tabindex="0"
				class="dropdown-content z-20 mt-1 left-0 w-fit rounded-box border border-base-300 bg-base-100 p-3 shadow-md"
				role="dialog"
				aria-label="Niveau du volume"
			>
				<div class="flex flex-col gap-2">
					<label class="flex flex-col gap-2">
						<span class="text-xs text-base-content/70">Volume — {volume} %</span>
						<input
							type="range"
							min="0"
							max="100"
							step="1"
							class="range range-xs w-36"
							value={volume}
							disabled={!!loadError}
							oninput={(e) => setVolumeLevel(Number(e.currentTarget.value))}
						/>
					</label>
					<button
						type="button"
						class="btn btn-ghost btn-xs w-fit"
						disabled={!!loadError}
						onclick={toggleMute}
					>
						{volume === 0 ? 'Réactiver le son' : 'Couper le son'}
					</button>
				</div>
			</div>
		</div>
	</div>

	{#if !ready && !loadError}
		<p class="text-xs text-base-content/60">Cliquez sur « Écouter » pour lancer la lecture.</p>
	{/if}

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
