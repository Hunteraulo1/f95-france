<script lang="ts">
	import type { HomeExtensionMockupGame } from '$lib/home-extension-mockup';
	import Bell from '@lucide/svelte/icons/bell';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import ClipboardCheck from '@lucide/svelte/icons/clipboard-check';
	import Maximize2 from '@lucide/svelte/icons/maximize-2';
	import ScanText from '@lucide/svelte/icons/scan-text';
	import Settings from '@lucide/svelte/icons/settings';

	interface Props {
		games: HomeExtensionMockupGame[];
		/** Dans le hero : pas de perspective/flottement propres (gérés par le parent). */
		heroEmbed?: boolean;
	}

	let { games, heroEmbed = false }: Props = $props();

	const fallbackGames: HomeExtensionMockupGame[] = [
		{
			id: 'fallback-1',
			name: 'Jeu exemple',
			image: 'https://picsum.photos/seed/f95ext-fallback/480/176',
			tversion: 'v1.0',
			upToDate: true
		}
	];

	const displayGames = $derived(
		games.filter((g) => g.image?.trim() && g.name?.trim()).length > 0
			? games.filter((g) => g.image?.trim() && g.name?.trim())
			: fallbackGames
	);

	const navItems = [
		{ icon: ScanText, active: true, badge: 0 },
		{ icon: Bell, active: false, badge: 764 },
		{ icon: Settings, active: false, badge: 0 },
		{ icon: Maximize2, active: false, badge: 0 }
	] as const;
</script>

<div
	class="relative mx-auto w-76 select-none {heroEmbed ? '' : 'perspective-distant'}"
	aria-hidden="true"
	inert
>
	<div
		class="pointer-events-none absolute inset-[6%_-12%_-6%] rounded-4xl bg-[radial-gradient(circle_at_50%_50%,color-mix(in_oklab,var(--color-secondary)_42%,transparent),transparent_70%)] blur-[20px]"
	></div>

	<div
		class="relative flex h-135 w-76 flex-col overflow-hidden rounded-lg border border-ext-border bg-ext-background text-ext-secondary-foreground shadow-[0_28px_56px_-14px_color-mix(in_oklab,var(--color-neutral)_55%,transparent)] {heroEmbed
			? ''
			: 'animate-float-sheet-reverse'}"
	>
		<div class="relative flex min-h-0 flex-1 flex-col gap-2 overflow-hidden p-2 pt-0">
			<div
				class="sticky top-0 z-10 mx-0.5 rounded-b-xl border border-ext-border bg-ext-card p-2 pb-8 text-center"
			>
				<p class="text-[0.65rem] leading-snug text-ext-secondary-foreground">
					Traduction détectée sur cette page
				</p>
				<div class="absolute top-8 right-0 flex w-full justify-center">
					<div
						class="flex items-center justify-center rounded-full border-2 border-ext-border bg-ext-card/40 px-4 py-2 text-ext-secondary-foreground transition-opacity hover:bg-ext-card/80"
					>
						<ChevronDown size={16} strokeWidth={2} aria-hidden="true" />
					</div>
				</div>
			</div>

			<div class="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
				{#each displayGames as game (game.id)}
					<div class="relative h-22 shrink-0 overflow-hidden rounded-md bg-ext-card">
						<img
							src={game.image}
							alt=""
							class="absolute inset-0 size-full object-cover"
							loading="lazy"
							draggable="false"
						/>
						<div
							class="relative flex h-full flex-col justify-end p-6 text-ext-secondary-foreground backdrop-brightness-90 transition hover:backdrop-brightness-100"
						>
							<p class="line-clamp-1 text-sm leading-tight font-semibold select-none">
								{game.name}
							</p>
							<p
								class="z-20 text-xs font-bold"
								class:text-green-700={game.upToDate}
								class:text-red-700={!game.upToDate}
							>
								{game.tversion}
							</p>
						</div>
						<div
							class="absolute top-1 right-1 rounded-full p-2 text-ext-secondary-foreground opacity-30"
						>
							<ClipboardCheck class="size-6" strokeWidth={2} aria-hidden="true" />
						</div>
					</div>
				{/each}
			</div>

			<div class="absolute right-0 bottom-0 left-0 flex justify-center pb-4">
				<div
					class="bottom-2 z-10 mx-auto mt-auto w-fit rounded-md border-2 border-ext-border bg-ext-card/80 px-4 py-1.5 text-center text-xs font-medium text-ext-secondary-foreground shadow-sm hover:bg-ext-card"
				>
					Filtrer
				</div>
			</div>
		</div>

		<div
			class="flex h-14 w-full shrink-0 justify-around gap-2 border-t-4 border-ext-border bg-ext-card p-1"
		>
			{#each navItems as item (item.icon)}
				<div
					class="relative flex flex-1 flex-col items-center justify-center rounded-md py-0.5 text-ext-secondary-foreground transition hover:opacity-100"
					class:opacity-50={!item.active}
				>
					{#if item.badge > 0}
						<span
							class="absolute top-0.5 left-1/2 z-10 rounded-lg bg-red-700 px-1 text-[0.6rem] leading-tight text-white"
						>
							{item.badge}
						</span>
					{/if}
					<item.icon class="size-6 shrink-0" strokeWidth={2} aria-hidden="true" />
				</div>
			{/each}
		</div>
	</div>
</div>
