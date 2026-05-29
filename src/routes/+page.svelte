<script lang="ts">
	import { resolve } from '$app/paths';
	import Header from '$lib/components/Header.svelte';
	import { roleDaisyBadgeClass, roleDaisyTextClass } from '$lib/utils/role-display';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import SquareArrowOutUpRight from '@lucide/svelte/icons/square-arrow-out-up-right';
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

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

	const sheetLineClass =
		'relative h-[0.7rem] overflow-hidden rounded-sm bg-base-content/16 before:absolute before:inset-y-0 before:left-0 before:w-[35%] before:bg-primary/28 before:opacity-50 before:animate-drift before:content-[""]';

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

<main class="flex w-full flex-1 flex-col gap-10 pb-10">
	<section class="hero min-h-screen relative overflow-hidden bg-transparent">
		<div class="top-0 absolute w-full z-40">
			<Header />
		</div>
		<div class="pointer-events-none absolute inset-0">
			<div
				class="hero-stars-layer"
				style={`--star-size:1px;--star-duration:50s;--star-shadow:${starsSmall};--star-offset-x:${starOffsetX}px;--star-travel:${starTravel}px;`}
			></div>
			<div
				class="hero-stars-layer"
				style={`--star-size:2px;--star-duration:100s;--star-shadow:${starsMedium};--star-offset-x:${starOffsetX}px;--star-travel:${starTravel}px;`}
			></div>
			<div
				class="hero-stars-layer"
				style={`--star-size:3px;--star-duration:150s;--star-shadow:${starsLarge};--star-offset-x:${starOffsetX}px;--star-travel:${starTravel}px;`}
			></div>
		</div>
		<div class="hero-overlay bg-transparent"></div>
		<div
			class="pointer-events-none absolute bottom-0 left-0 right-0 z-10 h-24 bg-linear-to-b from-transparent to-base-200"
		></div>
		<div
			class="hero-content max-w-none 2xl:px-64 sm:px-16 px-4 xs:px-8 relative z-20 w-full flex-col-reverse gap-16 py-10 text-neutral-content lg:flex-row items-center"
		>
			<div class="space-y-4 text-center sm:text-left">
				<h1 class="text-2xl xs:text-3xl sm:text-4xl font-bold leading-tight md:text-5xl">
					La communauté française qui fait vivre vos lewd games en VF
				</h1>
				<p class="text-neutral-content/90">
					F95 France rassemble traducteurs, relecteurs et joueurs pour suivre les sorties, améliorer
					les traductions et partager chaque avancée en français.
				</p>
				<div class="flex flex-wrap gap-3 justify-center sm:justify-start pt-4">
					<a href="/games" class="btn btn-primary" draggable="false">Explorer les jeux</a>
					<a
						href="/updates"
						class="btn btn-ghost text-neutral-content hover:border-primary transition-colors duration-300 hover:text-primary"
						draggable="false">Voir les mises à jour</a
					>
				</div>
			</div>
			<div
				class="lg:relative mt-4 w-full max-w-2xl perspective-distant absolute -z-20 opacity-25 lg:opacity-100 px-8 lg:px-0 select-none"
			>
				<div
					class="absolute inset-[12%_-6%_-12%] rounded-2xl bg-[radial-gradient(circle_at_50%_50%,color-mix(in_oklab,var(--color-primary)_42%,transparent),transparent_70%)] blur-[20px] opacity-50"
				></div>
				<div
					class="relative grid gap-[0.55rem] rounded-2xl border border-base-content/20 bg-base-100/85 p-4 shadow-[0_25px_50px_-12px_color-mix(in_oklab,var(--color-neutral)_45%,transparent),inset_0_1px_0_color-mix(in_oklab,white_40%,transparent)] animate-float-sheet"
				>
					<div class="flex items-center justify-between px-0.5 pt-0.5 pb-2">
						<span class="badge badge-primary badge-soft">Liste des traductions</span>
					</div>
					<div
						class="grid grid-cols-4 gap-2 rounded-lg bg-primary/16 p-2.5 sm:text-sm font-semibold text-base-content/82 text-xs"
					>
						<div class="line-clamp-1">NOM DU JEU</div>
						<div class="line-clamp-1">VERSION</div>
						<div class="line-clamp-1">TRAD. VER.</div>
						<div class="line-clamp-1">STATUS</div>
					</div>
					<div class="grid grid-cols-4 gap-2 rounded-lg border border-base-content/12 p-2.5">
						<div class="{sheetLineClass} w-[82%] before:[animation-delay:-0.2s]"></div>
						<div class="{sheetLineClass} w-[64%] before:[animation-delay:-1s]"></div>
						<div class="{sheetLineClass} w-[74%] before:[animation-delay:-1.8s]"></div>
						<div class="{sheetLineClass} w-[52%] before:[animation-delay:-2.6s]"></div>
					</div>
					<div class="grid grid-cols-4 gap-2 rounded-lg border border-base-content/12 p-2.5">
						<div class="{sheetLineClass} w-[64%] before:[animation-delay:-1s]"></div>
						<div class="{sheetLineClass} w-[52%] before:[animation-delay:-2.6s]"></div>
						<div class="{sheetLineClass} w-[82%] before:[animation-delay:-0.2s]"></div>
						<div class="{sheetLineClass} w-[74%] before:[animation-delay:-1.8s]"></div>
					</div>
					<div class="grid grid-cols-4 gap-2 rounded-lg border border-base-content/12 p-2.5">
						<div class="{sheetLineClass} w-[52%] before:[animation-delay:-2.6s]"></div>
						<div class="{sheetLineClass} w-[74%] before:[animation-delay:-1.8s]"></div>
						<div class="{sheetLineClass} w-[64%] before:[animation-delay:-1s]"></div>
						<div class="{sheetLineClass} w-[82%] before:[animation-delay:-0.2s]"></div>
					</div>
					<div class="grid grid-cols-4 gap-2 rounded-lg border border-base-content/12 p-2.5">
						<div class="{sheetLineClass} w-[74%] before:[animation-delay:-1.8s]"></div>
						<div class="{sheetLineClass} w-[82%] before:[animation-delay:-0.2s]"></div>
						<div class="{sheetLineClass} w-[52%] before:[animation-delay:-2.6s]"></div>
						<div class="{sheetLineClass} w-[64%] before:[animation-delay:-1s]"></div>
					</div>
					<div class="grid grid-cols-4 gap-2 rounded-lg border border-base-content/12 p-2.5">
						<div class="{sheetLineClass} w-[82%] before:[animation-delay:-0.2s]"></div>
						<div class="{sheetLineClass} w-[64%] before:[animation-delay:-1s]"></div>
						<div class="{sheetLineClass} w-[74%] before:[animation-delay:-1.8s]"></div>
						<div class="{sheetLineClass} w-[52%] before:[animation-delay:-2.6s]"></div>
					</div>
					<div class="grid grid-cols-4 gap-2 rounded-lg border border-base-content/12 p-2.5">
						<div class="{sheetLineClass} w-[64%] before:[animation-delay:-1s]"></div>
						<div class="{sheetLineClass} w-[74%] before:[animation-delay:-1.8s]"></div>
						<div class="{sheetLineClass} w-[52%] before:[animation-delay:-2.6s]"></div>
						<div class="{sheetLineClass} w-[82%] before:[animation-delay:-0.2s]"></div>
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

	<div class="mx-auto flex flex-col gap-32 px-2">
		<section>
			<div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-16">
				<h2 class="text-2xl font-bold">Dernières mises à jour</h2>
				<a href="/updates">
					<div
						class="badge badge-primary badge-soft badge-lg hover:border-primary hover:text-primary-content transition-colors duration-300"
					>
						<span class="mb-0.5 select-none">En voir plus</span>
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
				<div
					class="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 select-none"
				>
					{#each data.updates as update (update.updateId)}
						<article
							class="card card-border bg-base-100 aspect-4/3 last:hidden xl:last:flex md:last:hidden sm:last:flex max-w-sm"
						>
							<a
								href={update.game.gameLink}
								class="absolute flex items-center justify-center hover:opacity-100 opacity-0 sm:blocktop-0 left-0 w-full h-full rounded-lg hover:bg-black/30 transition-all duration-300 text-secondary"
								draggable="false"
							>
								<SquareArrowOutUpRight size={40} />
							</a>
							<div
								class="card-body p-4 gap-3 bg-cover bg-center rounded-lg"
								style={`background-image: url(${update.game.gameImage});`}
							>
								<div class="flex flex-col items-start justify-between gap-3">
									<span
										class={statusClass(update.updateStatus) + ' text-xs text-nowrap font-semibold'}
										>{statusLabel(update.updateStatus)}</span
									>
									<h3 class="card-title text-lg line-clamp-1">
										{update.game.name ?? 'Jeu inconnu'}
									</h3>
									<p>
										<span class="font-semibold">Version:</span>
										{update.game.gameVersion ?? '—'}
									</p>
								</div>
							</div>
						</article>
					{/each}
				</div>
			{/if}
		</section>

		<section>
			<div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-16">
				<h2 class="text-2xl font-bold">Membre de l'équipe</h2>
			</div>
			{#if !data.team.length}
				<div class="card card-border bg-base-100">
					<div class="card-body items-center gap-2 py-10 text-center">
						<p class="font-medium">Aucun membre staff à afficher</p>
						<p class="text-sm text-base-content/70">
							Les comptes dont le rôle est marqué « staff » apparaîtront ici.
						</p>
					</div>
				</div>
			{:else}
				<div
					class="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 select-none"
				>
					{#each data.team as team (team.teamId)}
						<a
							href={resolve(team.teamLink)}
							class="group card card-border bg-base-100 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg"
							draggable="false"
						>
							<div class="card-body items-center gap-3 p-4 text-center">
								<div class="avatar">
									<div
										class="w-20 rounded-full ring-2 ring-base-300 ring-offset-2 ring-offset-base-100 transition group-hover:ring-primary/50 sm:w-24"
									>
										<img draggable="false" src={team.teamImage} alt="" loading="lazy" />
									</div>
								</div>
								<div class="min-w-0 w-full space-y-2">
									<h3
										class="truncate text-base font-bold sm:text-lg {roleDaisyTextClass(
											team.teamRoleSlug,
											team.teamBadgeStyle
										)}"
									>
										{team.teamName}
									</h3>
									<span
										class="badge-sm max-w-full truncate {roleDaisyBadgeClass(
											team.teamRoleSlug,
											team.teamBadgeStyle
										)}"
									>
										{team.teamRole}
									</span>
								</div>
								<span
									class="flex items-center gap-1 text-xs font-medium text-base-content/50 transition group-hover:text-primary"
								>
									Voir le profil
									<SquareArrowOutUpRight class="h-3.5 w-3.5" />
								</span>
							</div>
						</a>
					{/each}
				</div>
			{/if}
		</section>
	</div>
</main>
