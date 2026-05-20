<script lang="ts">
	import { resolve } from '$app/paths';
	import Construction from '@lucide/svelte/icons/construction';
	import LogIn from '@lucide/svelte/icons/log-in';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import Wrench from '@lucide/svelte/icons/wrench';
	import { onMount } from 'svelte';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	const CYCLE_MINUTES = 1;
	const CYCLE_MS = CYCLE_MINUTES * 60 * 1000;
	const TICK_MS = 250;

	let progress = $state(0);
	let secondsLeft = $state(CYCLE_MINUTES * 60);
	let isRefreshing = $state(false);

	const formatRemaining = (totalSeconds: number): string => {
		const minutes = Math.floor(totalSeconds / 60);
		const seconds = totalSeconds % 60;
		if (minutes > 0 && seconds > 0) return `${minutes} min ${seconds} s`;
		if (minutes > 0) return `${minutes} min`;
		return `${seconds} s`;
	};

	const remainingLabel = $derived(
		isRefreshing
			? 'Rafraîchissement en cours…'
			: `Rafraîchissement automatique dans ${formatRemaining(secondsLeft)}`
	);

	onMount(() => {
		const startedAt = performance.now();

		const tick = () => {
			const elapsed = performance.now() - startedAt;
			const ratio = Math.min(elapsed / CYCLE_MS, 1);

			progress = ratio * 100;
			secondsLeft = Math.max(0, Math.ceil((CYCLE_MS - elapsed) / 1000));

			if (ratio >= 1) {
				isRefreshing = true;
				window.location.reload();
			}
		};

		tick();
		const intervalId = setInterval(tick, TICK_MS);

		return () => clearInterval(intervalId);
	});
</script>

<svelte:head>
	<title>Maintenance — {data.appName}</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div
	class="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-base-200 px-4 py-16"
>
	<div
		class="pointer-events-none absolute inset-0 bg-linear-to-br from-primary/5 via-transparent to-warning/10"
		aria-hidden="true"
	></div>
	<div
		class="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl"
		aria-hidden="true"
	></div>
	<div
		class="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-warning/10 blur-3xl"
		aria-hidden="true"
	></div>

	<main class="relative z-10 w-full max-w-lg">
		<div class="card border border-base-300/80 bg-base-100/95 shadow-2xl backdrop-blur-sm">
			<div class="card-body items-center gap-8 p-8 text-center sm:p-12">
				<div class="relative">
					<div
						class="flex h-20 w-20 items-center justify-center rounded-2xl bg-warning/15 text-warning shadow-inner"
					>
						<Construction size={40} strokeWidth={1.5} aria-hidden="true" />
					</div>
					<span
						class="absolute -top-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-content shadow-lg"
					>
						<Wrench size={16} aria-hidden="true" />
					</span>
				</div>

				<div class="flex flex-col gap-3">
					<p class="text-sm font-semibold tracking-widest text-primary uppercase">
						{data.appName}
					</p>
					<h1 class="text-3xl font-bold tracking-tight text-base-content">Site en maintenance</h1>
					<p class="max-w-sm text-base leading-relaxed text-base-content/70">
						Nous effectuons une mise à jour. Le service sera de retour très bientôt — merci pour
						votre patience.
					</p>
				</div>

				<div role="status" aria-live="polite" class="flex w-full flex-col gap-3">
					<progress
						class="progress w-full progress-warning transition-all duration-300 ease-linear"
						value={progress}
						max="100"
						aria-valuenow={Math.round(progress)}
						aria-valuemin={0}
						aria-valuemax={100}
						aria-label="Progression avant rafraîchissement automatique"
					></progress>
					<p class="text-xs text-base-content/50">
						{remainingLabel}
						<span class="text-base-content/35"> · cycle de {CYCLE_MINUTES}&nbsp;min</span>
					</p>
				</div>

				<div class="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
					<button
						type="button"
						class="btn gap-2 btn-outline btn-primary"
						onclick={() => window.location.reload()}
					>
						<RefreshCw size={18} aria-hidden="true" />
						Réessayer
					</button>
					<a href={resolve('/dashboard/login')} class="btn gap-2 btn-ghost">
						<LogIn size={18} aria-hidden="true" />
						Espace staff
					</a>
				</div>
			</div>
		</div>

		<p class="mt-8 text-center text-xs text-base-content/40">
			HTTP 503 · Service temporairement indisponible
		</p>
	</main>
</div>
