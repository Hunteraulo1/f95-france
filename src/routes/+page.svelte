<script lang="ts">
	import Header from '$lib/components/Header.svelte';
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

	const FIELD_SIZE = 2000;

	const createSeededRandom = (seed: number) => {
		let state = seed;
		return () => {
			state = (state * 1664525 + 1013904223) % 4294967296;
			return state / 4294967296;
		};
	};

	const buildStarShadows = (count: number, seed: number) => {
		const random = createSeededRandom(seed);
		const points: string[] = [];
		for (let i = 0; i < count; i++) {
			const x = Math.floor(random() * FIELD_SIZE);
			const y = Math.floor(random() * FIELD_SIZE);
			points.push(`${x}px ${y}px #FFF`);
		}
		return points.join(', ');
	};

	const starsSmall = buildStarShadows(280, 11);
	const starsMedium = buildStarShadows(100, 22);
	const starsLarge = buildStarShadows(50, 33);
</script>

<main class="flex w-full flex-1 flex-col gap-10">
	<section class="hero min-h-screen relative overflow-hidden bg-transparent">
		<div class="top-0 absolute w-full">
			<Header />
		</div>
		<div class="pointer-events-none absolute inset-0">
			<div
				class="stars-layer"
				style={`--star-size:1px;--star-duration:50s;--star-shadow:${starsSmall};`}
			></div>
			<div
				class="stars-layer"
				style={`--star-size:2px;--star-duration:100s;--star-shadow:${starsMedium};`}
			></div>
			<div
				class="stars-layer"
				style={`--star-size:3px;--star-duration:150s;--star-shadow:${starsLarge};`}
			></div>
		</div>
		<div class="hero-overlay bg-transparent"></div>
		<div
			class="pointer-events-none absolute bottom-0 left-0 right-0 z-10 h-24 bg-linear-to-b from-transparent to-base-200"
		></div>
		<div
			class="hero-content relative z-20 w-full flex-col items-start gap-6 py-10 text-neutral-content lg:flex-row lg:items-end lg:justify-between"
		>
			<div class="max-w-3xl space-y-4">
				<span class="badge badge-primary badge-soft">Communauté FR de traduction</span>
				<h1 class="text-4xl font-bold leading-tight md:text-5xl">
					La communauté française qui fait vivre vos jeux en VF
				</h1>
				<p class="max-w-2xl text-neutral-content/90">
					F95 France rassemble traducteurs, relecteurs et joueurs pour suivre les sorties, améliorer
					les traductions et partager chaque avancée en français.
				</p>
				<div class="flex flex-wrap gap-3">
					<a href="/games" class="btn btn-primary">Explorer les jeux</a>
					<a href="/updates" class="btn btn-ghost text-neutral-content">Voir les mises à jour</a>
				</div>
			</div>
			<div class="stats stats-vertical bg-base-100/90 text-base-content sm:stats-horizontal">
				<div class="stat">
					<div class="stat-title">Mises à jour récentes</div>
					<div class="stat-value text-primary">{data.updates.length}</div>
					<div class="stat-desc">Chargées en direct</div>
				</div>
				<div class="stat">
					<div class="stat-title">Objectif</div>
					<div class="stat-value text-secondary">100%</div>
					<div class="stat-desc">Passion et qualité FR</div>
				</div>
			</div>
		</div>
	</section>

	<div class="mx-auto max-w-7xl flex flex-col gap-10">
		<section class="space-y-6">
			<div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<h2 class="text-2xl font-bold">Dernières mises à jour</h2>
				<span class="badge badge-primary badge-soft badge-lg"
					>{data.updates.length} résultat(s)</span
				>
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
		left: 0;
		width: var(--star-size);
		height: var(--star-size);
		background: transparent;
		box-shadow: var(--star-shadow);
		animation: animStar var(--star-duration) linear infinite;
		content: '';
	}

	.stars-layer::after {
		top: 2000px;
	}

	@keyframes animStar {
		from {
			transform: translateY(0);
		}
		to {
			transform: translateY(-2000px);
		}
	}
</style>
