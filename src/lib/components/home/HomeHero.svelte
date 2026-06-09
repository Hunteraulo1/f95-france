<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import HomeHeroMockupFlip from '$lib/components/home/HomeHeroMockupFlip.svelte';
	import { SITE } from '$lib/site';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';

	interface HeroCta {
		href: string;
		label: string;
		external?: boolean;
	}

	interface HeroSlide {
		id: string;
		label: string;
		titleBefore: string;
		titleHighlight: string;
		titleAfter: string;
		highlightNeon?: boolean;
		lead: string;
		primaryCta: HeroCta;
		secondaryCta?: HeroCta;
		mockup: 'sheet' | 'discord' | 'wiki';
	}

	const slides: HeroSlide[] = [
		{
			id: 'vf',
			label: 'Traductions',
			titleBefore: 'La communauté française qui fait vivre vos',
			titleHighlight: 'LewdGames',
			titleAfter: 'en VF',
			highlightNeon: true,
			lead: 'F95 France rassemble traducteurs, relecteurs et joueurs pour suivre les sorties, améliorer les traductions et partager chaque avancée en français.',
			primaryCta: { href: '/games', label: 'Explorer les jeux' },
			secondaryCta: {
				href: 'https://tableau-traduction.f95france.site/',
				label: 'Accèder au tableur',
				external: true
			},
			mockup: 'sheet'
		},
		{
			id: 'discord',
			label: 'Discord',
			titleBefore: 'Échangez avec la communauté sur notre',
			titleHighlight: 'Discord',
			titleAfter: '',
			lead: 'Annonces des mises à jour, entraide traduction, discussions entre joueurs et suivi des sorties en temps réel avec l’équipe.',
			primaryCta: { href: SITE.discordInviteUrl, label: 'Rejoindre le serveur', external: true },
			mockup: 'discord'
		}
		// TODO: Uncomment when Wiki is back online
		// {
		// 	id: 'wiki',
		// 	label: 'Wiki',
		// 	titleBefore: 'Tout savoir grace au wiki de',
		// 	titleHighlight: 'F95 France',
		// 	titleAfter: '',
		// 	lead: 'Guides, tutoriels et documentation pour comprendre le site, contribuer aux traductions et tirer le meilleur parti des outils de la communauté.',
		// 	primaryCta: { href: SITE.wikiUrl, label: 'Consulter le wiki', external: true },
		// 	mockup: 'wiki'
		// }
	];

	const SLIDE_INTERVAL_MS = 7000;
	const DEFAULT_STAR_TRAVEL = 2000;

	const starLayerClass =
		'absolute top-0 bg-transparent [left:var(--star-offset-x)] [width:var(--star-size)] [height:var(--star-size)] [box-shadow:var(--star-shadow)] [animation:animStar_var(--star-duration)_linear_infinite] after:absolute after:top-[var(--star-travel)] after:left-0 after:bg-transparent after:content-[""] after:[width:var(--star-size)] after:[height:var(--star-size)] after:[box-shadow:var(--star-shadow)] after:[animation:animStar_var(--star-duration)_linear_infinite]';

	const starShadowCache: Record<string, { small: string; medium: string; large: string }> = {};

	const createSeededRandom = (seed: number) => {
		let state = seed;
		return () => {
			state = (state * 1664525 + 1013904223) % 4294967296;
			return state / 4294967296;
		};
	};

	const buildStarShadows = (
		count: number,
		seed: number,
		fieldWidth: number,
		fieldHeight: number
	) => {
		const random = createSeededRandom(seed);
		const points: string[] = [];
		for (let i = 0; i < count; i++) {
			const x = Math.floor(random() * fieldWidth);
			const y = Math.floor(random() * fieldHeight);
			points.push(`${x}px ${y}px var(--color-primary)`);
		}
		return points.join(', ');
	};

	let heroSectionEl: HTMLElement | null = null;
	let heroResizeObserver: ResizeObserver | null = null;

	let activeSlide = $state(0);
	let slidePaused = $state(false);
	let prefersReducedMotion = $state(false);
	let starTravel = $state(DEFAULT_STAR_TRAVEL);
	let starOffsetX = $state(0);
	let starsReady = $state(false);
	let starsSmall = $state('');
	let starsMedium = $state('');
	let starsLarge = $state('');
	let cachedFieldKey = $state('');
	let isAtTop = $state(true);
	let resizeFrame: number | null = null;
	let scrollFrame: number | null = null;
	let slideTimer: ReturnType<typeof setInterval> | null = null;

	const getStarShadows = (fieldWidth: number, fieldHeight: number) => {
		const key = `${fieldWidth}x${fieldHeight}`;
		let cached = starShadowCache[key];
		if (!cached) {
			cached = {
				small: buildStarShadows(100, 11, fieldWidth, fieldHeight),
				medium: buildStarShadows(36, 22, fieldWidth, fieldHeight),
				large: buildStarShadows(16, 33, fieldWidth, fieldHeight)
			};
			starShadowCache[key] = cached;
		}
		return cached;
	};

	const refreshStars = () => {
		const fieldWidth = heroSectionEl?.offsetWidth ?? window.innerWidth;
		const heroHeight = heroSectionEl?.offsetHeight ?? window.innerHeight;
		const fieldHeight = Math.max(1000, Math.ceil(heroHeight / 250) * 250);

		starTravel = fieldHeight;
		starOffsetX = 0;

		const fieldKey = `${fieldWidth}x${fieldHeight}`;
		if (fieldKey !== cachedFieldKey) {
			cachedFieldKey = fieldKey;
			const shadows = getStarShadows(fieldWidth, fieldHeight);
			starsSmall = shadows.small;
			starsMedium = shadows.medium;
			starsLarge = shadows.large;
		}
	};

	const scheduleRefreshStars = () => {
		if (resizeFrame !== null) return;
		resizeFrame = requestAnimationFrame(() => {
			resizeFrame = null;
			refreshStars();
		});
	};

	const updateScrollState = () => {
		isAtTop = window.scrollY < window.innerHeight / 4;
	};

	const scheduleUpdateScrollState = () => {
		if (scrollFrame !== null) return;
		scrollFrame = requestAnimationFrame(() => {
			scrollFrame = null;
			updateScrollState();
		});
	};

	const scrollToNextSection = () => {
		document.getElementById('home-updates')?.scrollIntoView({ behavior: 'smooth' });
	};

	const goToSlide = (index: number) => {
		const next = ((index % slides.length) + slides.length) % slides.length;
		if (next === activeSlide) return;
		activeSlide = next;
		if (!slidePaused) startSlideTimer();
	};

	const nextSlide = () => {
		goToSlide(activeSlide + 1);
	};

	const clearSlideTimer = () => {
		if (slideTimer !== null) {
			clearInterval(slideTimer);
			slideTimer = null;
		}
	};

	const startSlideTimer = () => {
		clearSlideTimer();
		if (slidePaused) return;
		slideTimer = setInterval(nextSlide, SLIDE_INTERVAL_MS);
	};

	const activateStars = () => {
		const run = () => {
			refreshStars();
			starsReady = true;
		};
		if ('requestIdleCallback' in window) {
			requestIdleCallback(run, { timeout: 1500 });
		} else {
			setTimeout(run, 0);
		}
	};

	const pauseSlides = () => {
		slidePaused = true;
		clearSlideTimer();
	};

	const resumeSlides = () => {
		slidePaused = false;
	};

	$effect(() => {
		if (slidePaused) {
			clearSlideTimer();
			return;
		}
		startSlideTimer();
		return () => clearSlideTimer();
	});

	onMount(() => {
		prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

		requestAnimationFrame(() => {
			requestAnimationFrame(activateStars);
		});
		scheduleUpdateScrollState();
		window.addEventListener('resize', scheduleRefreshStars, { passive: true });
		window.addEventListener('scroll', scheduleUpdateScrollState, { passive: true });

		if (heroSectionEl) {
			heroResizeObserver = new ResizeObserver(scheduleRefreshStars);
			heroResizeObserver.observe(heroSectionEl);
		}

		return () => {
			clearSlideTimer();
			heroResizeObserver?.disconnect();
			heroResizeObserver = null;
			if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
			if (scrollFrame !== null) cancelAnimationFrame(scrollFrame);
			window.removeEventListener('resize', scheduleRefreshStars);
			window.removeEventListener('scroll', scheduleUpdateScrollState);
		};
	});
</script>

<section
	bind:this={heroSectionEl}
	class="hero min-h-screen relative overflow-x-clip overflow-y-hidden bg-transparent"
	aria-label="Présentation F95 France"
	onmouseenter={pauseSlides}
	onmouseleave={resumeSlides}
>
	<div class="top-0 absolute w-full z-40">
		<Header />
	</div>
	{#if starsReady}
		<div
			class="pointer-events-none absolute inset-0 z-0 overflow-hidden mask-[linear-gradient(to_top,transparent,#000_8rem)] [-webkit-mask-image:linear-gradient(to_top,transparent,#000_8rem)]"
			aria-hidden="true"
		>
			<div
				class={starLayerClass}
				style={`--star-size:1px;--star-duration:50s;--star-shadow:${starsSmall};--star-offset-x:${starOffsetX}px;--star-travel:${starTravel}px;`}
			></div>
			<div
				class={starLayerClass}
				style={`--star-size:2px;--star-duration:100s;--star-shadow:${starsMedium};--star-offset-x:${starOffsetX}px;--star-travel:${starTravel}px;`}
			></div>
			<div
				class={starLayerClass}
				style={`--star-size:3px;--star-duration:150s;--star-shadow:${starsLarge};--star-offset-x:${starOffsetX}px;--star-travel:${starTravel}px;`}
			></div>
		</div>
	{/if}
	<div class="hero-overlay bg-transparent"></div>
	<div
		class="pointer-events-none absolute bottom-0 left-0 right-0 z-10 h-24 bg-linear-to-b from-transparent to-base-200"
	></div>
	<div
		class="hero-content max-w-none 2xl:px-32 sm:px-16 px-4 xs:px-8 relative z-20 w-full flex-col-reverse gap-16 py-10 text-base-foreground xl:flex-row xl:items-center"
	>
		<div class="w-full min-w-0 max-w-2xl flex-1 space-y-4 text-center xl:text-left">
			<div class="grid w-full grid-cols-[minmax(0,1fr)]">
				{#each slides as slide, slideIndex (slide.id)}
					<div
						class="col-start-1 row-start-1 min-w-0 w-full space-y-4 transition-opacity ease-in-out {slideIndex ===
						activeSlide
							? 'relative z-1 opacity-100'
							: 'pointer-events-none opacity-0'}"
						style:transition-duration={prefersReducedMotion ? '200ms' : '420ms'}
						aria-hidden={slideIndex !== activeSlide}
					>
						<h1
							id={slideIndex === activeSlide ? 'home-hero-title text-current' : undefined}
							class="text-2xl xs:text-3xl sm:text-4xl font-bold leading-tight md:text-5xl"
						>
							{slide.titleBefore}
							<span
								class="mx-1 inline-block {slide.highlightNeon
									? '[text-shadow:0_0_10px_color-mix(in_oklab,#ff005e_35%,transparent)] sm:animate-neon-glow sm:text-shadow:none'
									: 'text-primary'}"
							>
								{slide.titleHighlight}
							</span>
							{#if slide.titleAfter}
								{slide.titleAfter}
							{/if}
						</h1>
						<p class="text-current/90">{slide.lead}</p>
						<div class="flex flex-wrap gap-3 justify-center xl:justify-start pt-4">
							<a
								href={slide.primaryCta.href}
								class="btn btn-primary"
								draggable="false"
								target={slide.primaryCta.external ? '_blank' : undefined}
								rel={slide.primaryCta.external ? 'noopener noreferrer' : undefined}
							>
								{slide.primaryCta.label}
							</a>
							{#if slide.secondaryCta}
								<a
									href={slide.secondaryCta.href}
									class="btn btn-ghost hover:border-primary transition-colors duration-300 hover:text-primary"
									draggable="false"
									target={slide.secondaryCta?.external ? '_blank' : undefined}
									rel={slide.secondaryCta?.external ? 'noopener noreferrer' : undefined}
								>
									{slide.secondaryCta.label}
								</a>
							{/if}
						</div>
					</div>
				{/each}
			</div>
			<div
				class="flex items-center justify-center gap-2 pt-2 xl:justify-start"
				role="tablist"
				aria-label="Aperçus du hero"
			>
				{#each slides as slide, index (slide.id)}
					<button
						type="button"
						role="tab"
						class="btn btn-xs btn-circle transition-colors {index === activeSlide
							? 'btn-primary'
							: 'btn-ghost border border-base-content/25 text-base-content/70'}"
						aria-selected={index === activeSlide}
						aria-label={slide.label}
						onclick={() => goToSlide(index)}
					>
						<span class="sr-only">{slide.label}</span>
					</button>
				{/each}
			</div>
		</div>

		<div
			class="xl:relative mt-4 w-full max-w-2xl perspective-distant absolute -z-20 opacity-25 px-8 select-none xl:opacity-100 xl:px-0 -translate-x-4"
		>
			<HomeHeroMockupFlip {activeSlide} {slides} />
		</div>
	</div>
	{#if isAtTop}
		<button
			transition:fade={{ duration: 250 }}
			aria-label="Faire défiler vers le bas"
			class="btn hover:border-primary hover:text-primary border-secondary border-2 btn-circle mt-auto mb-8 btn-outline animate-bounce absolute bottom-0 text-secondary"
			onclick={scrollToNextSection}
		>
			<ChevronDown size={24} strokeWidth={4} />
		</button>
	{/if}
</section>
