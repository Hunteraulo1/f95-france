<script lang="ts">
	import { onMount } from 'svelte';

	type TurnstileApi = {
		render: (
			container: HTMLElement,
			options: {
				sitekey: string;
				callback?: (token: string) => void;
				'expired-callback'?: () => void;
				'error-callback'?: () => void;
				theme?: 'light' | 'dark' | 'auto';
			}
		) => string;
		reset: (widgetId?: string) => void;
		remove: (widgetId: string) => void;
	};

	interface Props {
		siteKey: string;
		token?: string;
		theme?: 'light' | 'dark' | 'auto';
	}

	let { siteKey, token = $bindable(''), theme = 'auto' }: Props = $props();

	let container = $state<HTMLDivElement | null>(null);
	let widgetId = $state<string | undefined>();
	let loadError = $state<string | null>(null);

	const TURNSTILE_SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

	function getTurnstile(): TurnstileApi | undefined {
		return (globalThis as typeof globalThis & { turnstile?: TurnstileApi }).turnstile;
	}

	function clearToken() {
		token = '';
	}

	export function resetWidget() {
		const api = getTurnstile();
		if (api && widgetId) {
			api.reset(widgetId);
		}
		clearToken();
	}

	function renderWidget() {
		const api = getTurnstile();
		if (!api || !container || !siteKey) return;

		if (widgetId) {
			api.remove(widgetId);
			widgetId = undefined;
		}

		widgetId = api.render(container, {
			sitekey: siteKey,
			theme,
			callback: (value) => {
				token = value;
			},
			'expired-callback': clearToken,
			'error-callback': clearToken
		});
	}

	function loadTurnstileScript(): Promise<void> {
		const existing = getTurnstile();
		if (existing) return Promise.resolve();

		return new Promise((resolve, reject) => {
			const current = document.querySelector<HTMLScriptElement>(
				`script[src^="${TURNSTILE_SCRIPT}"]`
			);
			if (current) {
				current.addEventListener('load', () => resolve(), { once: true });
				current.addEventListener('error', () => reject(new Error('turnstile script')), {
					once: true
				});
				return;
			}

			const script = document.createElement('script');
			script.src = TURNSTILE_SCRIPT;
			script.async = true;
			script.defer = true;
			script.onload = () => resolve();
			script.onerror = () => reject(new Error('turnstile script'));
			document.head.appendChild(script);
		});
	}

	onMount(() => {
		if (!siteKey) {
			loadError = 'Captcha non configuré.';
			return;
		}

		loadTurnstileScript()
			.then(() => renderWidget())
			.catch(() => {
				loadError = 'Impossible de charger le captcha.';
			});

		return () => {
			const api = getTurnstile();
			if (api && widgetId) {
				api.remove(widgetId);
			}
		};
	});
</script>

<div class="flex w-full flex-col items-center gap-2">
	<div bind:this={container} class="min-h-[65px] w-full"></div>
	{#if loadError}
		<p class="text-center text-sm text-error">{loadError}</p>
	{/if}
</div>
