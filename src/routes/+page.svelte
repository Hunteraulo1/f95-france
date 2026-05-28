<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const formattedDate = new Intl.DateTimeFormat('fr-FR', {
		dateStyle: 'medium',
		timeStyle: 'short'
	});

	const parseTags = (tags: string | null) =>
		(tags ?? '')
			.split(',')
			.map((tag) => tag.trim())
			.filter(Boolean);

	const statusClass = (status: string | null) => {
		switch (status) {
			case 'new':
				return 'badge badge-success badge-soft';
			case 'update':
				return 'badge badge-info badge-soft';
			case 'hotfix':
				return 'badge badge-warning badge-soft';
			default:
				return 'badge badge-neutral badge-soft';
		}
	};

	const statusLabel = (status: string | null) => {
		switch (status) {
			case 'new':
				return 'Nouvelle sortie';
			case 'update':
				return 'Mise à jour';
			case 'hotfix':
				return 'Correctif';
			default:
				return 'Info';
		}
	};

	const normalizeHref = (href: string): string => href;

	const DEFAULT_FIELD_SIZE = 2000;

	const createSeededRandom = (seed: number) => {
		let state = seed;
		return () => {
			state = (state * 1664525 + 1013904223) % 4294967296;
			return state / 4294967296;
		};
	};

	const buildStarShadows = (count: number, seed: number, fieldSize: number) => {
		const random = createSeededRandom(seed);
		const points: string[] = [];
		for (let i = 0; i < count; i++) {
			const x = Math.floor(random() * fieldSize);
			const y = Math.floor(random() * fieldSize);
			points.push(`${x}px ${y}px #FFF`);
		}
		return points.join(', ');
	};

	let starTravel = $state(DEFAULT_FIELD_SIZE);
	let starOffsetX = $state(-1000);
	let starsSmall = $state(buildStarShadows(280, 11, DEFAULT_FIELD_SIZE));
	let starsMedium = $state(buildStarShadows(100, 22, DEFAULT_FIELD_SIZE));
	let starsLarge = $state(buildStarShadows(50, 33, DEFAULT_FIELD_SIZE));
	let isAtTop = $state(true);

	const computeStarFieldSize = () => {
		const largestSide = Math.max(window.innerWidth, window.innerHeight);
		return Math.min(8000, Math.max(2500, Math.ceil((largestSide * 1.8) / 500) * 500));
	};

	const refreshStars = () => {
		const fieldSize = computeStarFieldSize();
		starTravel = fieldSize;
		starOffsetX = Math.floor((window.innerWidth - fieldSize) / 2);
		starsSmall = buildStarShadows(280, 11, fieldSize);
		starsMedium = buildStarShadows(100, 22, fieldSize);
		starsLarge = buildStarShadows(50, 33, fieldSize);
	};

	const updateScrollState = () => {
		isAtTop = window.scrollY < window.innerHeight / 4;
	};

	const scrollDownOneVh = () => {
		window.scrollBy({ top: window.innerHeight, behavior: 'smooth' });
	};

	onMount(() => {
		refreshStars();
		updateScrollState();
		window.addEventListener('resize', refreshStars);
		window.addEventListener('scroll', updateScrollState, { passive: true });
		return () => {
			window.removeEventListener('resize', refreshStars);
			window.removeEventListener('scroll', updateScrollState);
		};
	});
</script>

<main class="flex w-full flex-1 flex-col gap-10">
	<section class="hero min-h-screen relative overflow-hidden bg-transparent">
		<div class="top-0 absolute w-full">
			<Header />
		</div>
		<div class="pointer-events-none absolute inset-0">
			<div
				class="stars-layer"
				style={`--star-size:1px;--star-duration:50s;--star-shadow:${starsSmall};--star-offset-x:${starOffsetX}px;--star-travel:${starTravel}px;`}
			></div>
			<div
				class="stars-layer"
				style={`--star-size:2px;--star-duration:100s;--star-shadow:${starsMedium};--star-offset-x:${starOffsetX}px;--star-travel:${starTravel}px;`}
			></div>
			<div
				class="stars-layer"
				style={`--star-size:3px;--star-duration:150s;--star-shadow:${starsLarge};--star-offset-x:${starOffsetX}px;--star-travel:${starTravel}px;`}
			></div>
		</div>
		<div class="hero-overlay bg-transparent"></div>
		<div
			class="pointer-events-none absolute bottom-0 left-0 right-0 z-10 h-24 bg-linear-to-b from-transparent to-base-200"
		></div>
		<div
			class="hero-content max-w-none 2xl:px-64 px-16 relative z-20 w-full flex-col-reverse gap-16 py-10 text-neutral-content lg:flex-row items-center"
		>
			<div class="space-y-4">
				<h1 class="text-4xl font-bold leading-tight md:text-5xl">
					La communauté française qui fait vivre vos lewd games en VF
				</h1>
				<p class="text-neutral-content/90">
					F95 France rassemble traducteurs, relecteurs et joueurs pour suivre les sorties, améliorer
					les traductions et partager chaque avancée en français.
				</p>
				<div class="flex flex-wrap gap-3">
					<a href="/games" class="btn btn-primary">Explorer les jeux</a>
					<a
						href="/updates"
						class="btn btn-ghost text-neutral-content hover:border-primary transition-colors duration-300 hover:text-primary"
						>Voir les mises à jour</a
					>
				</div>
			</div>
			<div class="sheet-illustration">
				<div class="sheet-glow"></div>
				<div class="sheet-paper">
					<div class="sheet-toolbar">
						<span class="badge badge-primary badge-soft">Liste des traductions</span>
					</div>
					<div class="sheet-header">
						<div>NON DU JEU</div>
						<div>VERSION</div>
						<div>TRAD. VER.</div>
						<div>STATUS</div>
					</div>
					<div class="sheet-row">
						<div class="sheet-text-line line-a"></div>
						<div class="sheet-text-line line-b"></div>
						<div class="sheet-text-line line-c"></div>
						<div class="sheet-text-line line-d"></div>
					</div>
					<div class="sheet-row">
						<div class="sheet-text-line line-b"></div>
						<div class="sheet-text-line line-d"></div>
						<div class="sheet-text-line line-a"></div>
						<div class="sheet-text-line line-c"></div>
					</div>
					<div class="sheet-row">
						<div class="sheet-text-line line-d"></div>
						<div class="sheet-text-line line-c"></div>
						<div class="sheet-text-line line-b"></div>
						<div class="sheet-text-line line-a"></div>
					</div>
					<div class="sheet-row">
						<div class="sheet-text-line line-c"></div>
						<div class="sheet-text-line line-a"></div>
						<div class="sheet-text-line line-d"></div>
						<div class="sheet-text-line line-b"></div>
					</div>
					<div class="sheet-row">
						<div class="sheet-text-line line-a"></div>
						<div class="sheet-text-line line-b"></div>
						<div class="sheet-text-line line-c"></div>
						<div class="sheet-text-line line-d"></div>
					</div>
					<div class="sheet-row">
						<div class="sheet-text-line line-b"></div>
						<div class="sheet-text-line line-c"></div>
						<div class="sheet-text-line line-d"></div>
						<div class="sheet-text-line line-a"></div>
					</div>
				</div>
			</div>
		</div>
		{#if isAtTop}
			<button
				transition:fade={{ duration: 250 }}
				aria-label="Faire défiler vers le bas"
				class="btn hover:border-primary hover:text-primary btn-circle mt-auto mb-8 btn-outline animate-bounce absolute bottom-0"
				onclick={scrollDownOneVh}
			>
				<ChevronDown class="h-5 w-5" />
			</button>
		{/if}
	</section>

	<div class="mx-auto max-w-7xl flex flex-col gap-10">
		<section class="space-y-6">
			<div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<h2 class="text-2xl font-bold">Dernières mises à jour</h2>
				<a href="/updates">
					<div
						class="badge badge-primary badge-soft badge-lg hover:border-primary hover:text-primary-content transition-colors duration-300"
					>
						<span class="mb-0.5">En voir plus</span>
						<ArrowRight class="h-4 w-4 hover:translate-x-1 transition-transform duration-300" />
					</div>
				</a>
			</div>
			{#if data.error}
				<div role="alert" class="alert alert-warning">
					<span>{data.error}</span>
				</div>
			{/if}
			{#if !data.updates.length}
				<div class="card card-border bg-base-100">
					<div class="card-body items-start">
						<h3 class="card-title">Aucune mise à jour disponible</h3>
						<p class="text-base-content/70">
							Revenez plus tard pour consulter les dernières sorties de la communauté.
						</p>
					</div>
				</div>
			{:else}
				<div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
					{#each data.updates as update (update.updateId)}
						<article class="card card-border bg-base-100">
							<div class="card-body gap-3">
								<div class="flex items-start justify-between gap-3">
									<h3 class="card-title text-lg">{update.game.name ?? 'Jeu inconnu'}</h3>
									<span class={statusClass(update.updateStatus)}
										>{statusLabel(update.updateStatus)}</span
									>
								</div>
								<div class="space-y-1 text-sm">
									<p>
										<span class="font-semibold">Version:</span>
										{update.game.gameVersion ?? '—'}
									</p>
									<p>
										<span class="font-semibold">Site:</span>
										{update.game.gameWebsite ?? '—'}
									</p>
									<p>
										<span class="font-semibold">Date:</span>
										{update.updateCreatedAt
											? formattedDate.format(new Date(update.updateCreatedAt))
											: '—'}
									</p>
								</div>
								<div class="flex flex-wrap gap-2">
									{#if parseTags(update.game.gameTags).length}
										{#each parseTags(update.game.gameTags) as tag (tag)}
											<span class="badge badge-outline">{tag}</span>
										{/each}
									{:else}
										<span class="badge badge-ghost">Aucun tag</span>
									{/if}
								</div>
								{#if update.game.gameEngineTypes.length}
									<div class="flex flex-wrap gap-2">
										{#each update.game.gameEngineTypes as engine (engine)}
											<span class="badge badge-secondary badge-soft">{engine}</span>
										{/each}
									</div>
								{/if}
								{#if update.game.gameLink}
									<div class="card-actions justify-end">
										<a
											class="btn btn-primary btn-sm"
											href={normalizeHref(update.game.gameLink)}
											target="_blank"
											rel="noopener noreferrer"
										>
											Voir le jeu
										</a>
									</div>
								{/if}
							</div>
						</article>
					{/each}
				</div>
			{/if}
		</section>
	</div>
</main>

<style>
	.stars-layer,
	.stars-layer::after {
		position: absolute;
		left: var(--star-offset-x);
		width: var(--star-size);
		height: var(--star-size);
		background: transparent;
		box-shadow: var(--star-shadow);
		animation: animStar var(--star-duration) linear infinite;
		content: '';
	}

	.stars-layer::after {
		top: var(--star-travel);
	}

	@keyframes animStar {
		from {
			transform: translateY(0);
		}
		to {
			transform: translateY(calc(var(--star-travel) * -1));
		}
	}

	.sheet-illustration {
		position: relative;
		width: 100%;
		max-width: 42rem;
		margin-top: 1rem;
		perspective: 1200px;
	}

	.sheet-glow {
		position: absolute;
		inset: 12% -6% -12%;
		border-radius: 1.25rem;
		background: radial-gradient(
			circle at 50% 50%,
			color-mix(in oklab, var(--color-primary) 42%, transparent) 0%,
			transparent 70%
		);
		filter: blur(20px);
		opacity: 0.5;
	}

	.sheet-paper {
		position: relative;
		display: grid;
		gap: 0.55rem;
		padding: 1rem;
		border: 1px solid color-mix(in oklab, var(--color-base-content) 20%, transparent);
		border-radius: 1rem;
		background: color-mix(in oklab, var(--color-base-100) 85%, transparent);
		box-shadow:
			0 25px 50px -12px color-mix(in oklab, var(--color-neutral) 45%, transparent),
			inset 0 1px 0 color-mix(in oklab, white 40%, transparent);
		transform: rotateX(14deg) rotateY(-16deg) rotateZ(3deg);
		animation: floatSheet 8s ease-in-out infinite;
	}

	.sheet-toolbar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.2rem 0.1rem 0.5rem;
	}

	.sheet-header,
	.sheet-row {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 0.5rem;
		padding: 0.55rem;
		border-radius: 0.5rem;
	}

	.sheet-header {
		background-color: color-mix(in oklab, var(--color-primary) 16%, transparent);
		font-size: 0.78rem;
		font-weight: 600;
		color: color-mix(in oklab, var(--color-base-content) 82%, transparent);
	}

	.sheet-row {
		border: 1px solid color-mix(in oklab, var(--color-base-content) 12%, transparent);
	}

	.sheet-text-line {
		position: relative;
		height: 0.7rem;
		overflow: hidden;
		border-radius: 0.25rem;
		background: color-mix(in oklab, var(--color-base-content) 16%, transparent);
	}

	.sheet-text-line::before {
		position: absolute;
		inset-block: 0;
		left: 0;
		width: 35%;
		background: color-mix(in oklab, var(--color-primary) 28%, transparent);
		opacity: 0.5;
		animation: drift 6s ease-in-out infinite;
		content: '';
	}

	.line-a {
		width: 82%;
	}

	.line-b {
		width: 64%;
	}

	.line-c {
		width: 74%;
	}

	.line-d {
		width: 52%;
	}

	.line-a::before {
		animation-delay: -0.2s;
	}

	.line-b::before {
		animation-delay: -1s;
	}

	.line-c::before {
		animation-delay: -1.8s;
	}

	.line-d::before {
		animation-delay: -2.6s;
	}

	@keyframes drift {
		0%,
		100% {
			transform: translateX(0);
		}
		50% {
			transform: translateX(160%);
		}
	}

	@keyframes floatSheet {
		0%,
		100% {
			transform: rotateX(14deg) rotateY(-16deg) rotateZ(3deg) translateY(0);
		}
		50% {
			transform: rotateX(12deg) rotateY(-12deg) rotateZ(2deg) translateY(-8px);
		}
	}
</style>
