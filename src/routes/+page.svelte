<script lang="ts">
	import { resolve } from '$app/paths';
	import HomeHero from '$lib/components/home/HomeHero.svelte';
	import LazyWhenVisible from '$lib/components/LazyWhenVisible.svelte';
	import { formatTranslationVersionDisplay } from '$lib/games/public-game-display';
	import { resolveDiscordAvatarDisplayUrl } from '$lib/utils/discord-avatar-url';
	import { resolveGameImageSrc } from '$lib/utils/game-image-url';
	import { roleDaisyBadgeClass, roleDaisyTextClass } from '$lib/utils/role-display';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import SquareArrowOutUpRight from '@lucide/svelte/icons/square-arrow-out-up-right';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const statusClass = (status: string | null) => {
		switch (status) {
			case 'update':
				return 'badge badge-info badge-soft';
			case 'adding':
				return 'badge badge-primary badge-soft';
			default:
				return 'badge badge-neutral badge-soft';
		}
	};

	const statusLabel = (status: string | null) => {
		switch (status) {
			case 'update':
				return 'Mise à jour';
			case 'adding':
				return 'Ajout de jeu';
			default:
				return 'Info';
		}
	};
</script>

<main class="flex w-full flex-1 flex-col gap-16">
	<HomeHero />

	<section
		class="px-auto mx-auto flex w-full max-w-7xl flex-col gap-16 px-2 pt-16"
		id="home-updates"
	>
		<div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
			<h2 class="text-2xl font-bold">Derniers changements</h2>
			<a href="/updates">
				<div
					class="badge badge-outline badge-lg transition-colors duration-300 badge-primary hover:border-primary hover:text-primary-content"
				>
					<span class="mb-0.5 select-none">En voir plus</span>
					<ArrowRight class="h-4 w-4 transition-transform duration-300 hover:translate-x-1" />
				</div>
			</a>
		</div>
		{#if data.error}
			<div role="alert" class="alert alert-warning">
				<span>{data.error}</span>
			</div>
		{/if}
		{#if !data.updates.length}
			<div class="card bg-base-100 card-border">
				<div class="card-body items-start">
					<h3 class="card-title">Aucune mise à jour disponible</h3>
					<p class="text-base-content/70">
						Revenez plus tard pour consulter les dernières sorties de la communauté.
					</p>
				</div>
			</div>
		{:else}
			<div class="grid grid-cols-1 gap-4 select-none xs:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
				{#each data.updates as update (update.updateId)}
					{@const homeUpdateImageSrc = resolveGameImageSrc(update.game.gameImage, {
						website: update.game.gameWebsite
					})}
					<article
						class="card relative aspect-4/3 overflow-hidden bg-base-100 card-border last:hidden xs:last:flex sm:last:hidden lg:last:flex"
					>
						{#if homeUpdateImageSrc}
							<img
								src={homeUpdateImageSrc}
								alt=""
								class="absolute inset-0 h-full w-full object-cover"
								loading="lazy"
								decoding="async"
								referrerpolicy="no-referrer"
								draggable="false"
							/>
						{:else}
							<div class="absolute inset-0 bg-base-300" aria-hidden="true">
								<div
									class="flex h-full w-full items-center justify-center text-sm text-base-content/50"
								>
									Pas d’aperçu
								</div>
							</div>
						{/if}
						<a
							href={resolve(`/games/${update.game.gameId}`)}
							aria-label={`Voir la fiche du jeu ${update.game.name ?? 'inconnu'}`}
							class="absolute inset-0 z-20 flex items-center justify-center rounded-lg text-secondary opacity-0 transition-all duration-300 hover:bg-black/30 hover:opacity-100"
							draggable="false"
						>
							<SquareArrowOutUpRight size={40} />
						</a>
						<div
							class="pointer-events-none absolute inset-0 bg-linear-to-b from-black/55 via-black/15 to-transparent"
							aria-hidden="true"
						></div>
						<div class="relative z-10 card-body flex h-full flex-col justify-start gap-3 p-4">
							<div
								class="flex flex-col items-start justify-between gap-3 text-neutral-content drop-shadow-sm"
							>
								<span
									class={statusClass(update.updateStatus) + ' text-xs font-semibold text-nowrap'}
									>{statusLabel(update.updateStatus)}</span
								>
								<h3 class="card-title line-clamp-1 text-lg">
									{update.game.name ?? 'Jeu inconnu'}
								</h3>
								<p>
									<span class="font-semibold">Version:</span>
									{#if update.game.hasTranslation}
										{formatTranslationVersionDisplay({
											tversion: update.game.tversion,
											referenceVersion: update.game.referenceVersion,
											isOutdated: update.game.isOutdated,
											isIntegrated: update.game.isIntegrated
										})}
									{:else}
										{update.game.gameVersion ?? '—'}
									{/if}
								</p>
							</div>
						</div>
					</article>
				{/each}
			</div>
		{/if}
	</section>

	<LazyWhenVisible class="mx-auto w-full max-w-7xl px-2 pt-16">
		{#await import('$lib/components/DiscordBanner.svelte') then { default: DiscordBanner }}
			<DiscordBanner />
		{/await}
	</LazyWhenVisible>

	<LazyWhenVisible class="mx-auto w-full max-w-7xl px-2">
		{#await import('$lib/components/ExtensionBanner.svelte') then { default: ExtensionBanner }}
			<ExtensionBanner
				games={data.extensionMockupGames}
				extensionDownloads={data.extensionDownloads}
				extensionBrowserTarget={data.extensionBrowserTarget}
			/>
		{/await}
	</LazyWhenVisible>

	<section class="px-auto mx-auto flex w-full max-w-7xl flex-col gap-16 px-2">
		<div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
			<h2 class="text-2xl font-bold">Membre de l'équipe</h2>
		</div>
		{#if !data.team.length}
			<div class="card bg-base-100 card-border">
				<div class="card-body items-center gap-2 py-10 text-center">
					<p class="font-medium">Aucun membre staff à afficher</p>
					<p class="text-sm text-base-content/70">
						Les comptes dont le rôle est marqué « staff » apparaîtront ici.
					</p>
				</div>
			</div>
		{:else}
			<div class="grid grid-cols-1 gap-4 select-none sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
				{#each data.team as team (team.teamId)}
					<a
						href={resolve(team.teamLink)}
						class="group card bg-base-100 shadow-sm transition card-border hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg"
						draggable="false"
					>
						<div class="card-body items-center gap-3 p-4 text-center">
							<div class="avatar">
								<div
									class="w-20 rounded-full ring-2 ring-base-300 ring-offset-2 ring-offset-base-100 transition group-hover:ring-primary/50 sm:w-24"
								>
									<img
										draggable="false"
										src={resolveDiscordAvatarDisplayUrl(team.teamImage)}
										alt=""
										loading="lazy"
									/>
								</div>
							</div>
							<div class="w-full min-w-0 space-y-2">
								<h3
									class="truncate text-base font-bold sm:text-lg {roleDaisyTextClass(
										team.teamRoleSlug,
										team.teamBadgeStyle
									)}"
								>
									{team.teamName}
								</h3>
								<span
									class="max-w-full truncate badge-sm {roleDaisyBadgeClass(
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
</main>
