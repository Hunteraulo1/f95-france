<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import {
		engineDisplayLabel,
		progressDisplayLabel,
		translationKindLabel,
		translationStatusBadgeClass,
		translationTypeDisplayLabel,
		translationVersionSyncBadgeClass,
		translationVersionSyncLabel
	} from '$lib/games/public-game-display';
	import { getGameEngineHexColor } from '$lib/utils/game-engine-colors';
	import { resolveGameImageSrc } from '$lib/utils/game-image-url';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	const game = $derived(data.game);
	const imageSrc = $derived(game ? resolveGameImageSrc(game.image, { website: game.website }) : '');

	const updateStatusLabel = (status: string) => {
		switch (status) {
			case 'update':
				return 'Mise à jour';
			case 'adding':
				return 'Ajout de jeu';
			default:
				return status;
		}
	};

	const updateStatusClass = (status: string) => {
		switch (status) {
			case 'update':
				return 'badge badge-info badge-soft';
			case 'adding':
				return 'badge badge-primary text-primary-content';
			default:
				return 'badge badge-neutral text-neutral-content';
		}
	};

	const websiteBadgeClass = () => {
		return 'badge badge-secondary';
	};

	const backLink = $derived(typeof history !== 'undefined' && history.length > 1);
	const goBack = () => {
		if (backLink) {
			history.back();
			return;
		}
		void goto(resolve('/games'));
	};
</script>

<svelte:head>
	<title>{game ? `${game.name} — Jeu` : 'Jeu'} — F95 France</title>
</svelte:head>

<main class="mx-auto w-full flex-1 px-4 py-8 sm:px-16 max-w-7xl">
	<button type="button" class="btn btn-ghost btn-sm mb-6 gap-2" onclick={goBack}>
		<ArrowLeft class="h-4 w-4" />
		{backLink ? 'Retour en arrière' : 'Retour aux jeux'}
	</button>

	{#if data.error || !game}
		<div role="alert" class="alert alert-warning">
			<span>{data.error ?? 'Jeu introuvable.'}</span>
		</div>
	{:else}
		<article class="flex flex-col gap-8">
			<header class="card border border-base-300 bg-base-100 shadow-sm overflow-hidden">
				<div class="grid gap-0 lg:grid-cols-[minmax(280px,360px)_1fr]">
					<figure class="relative aspect-video bg-base-300 lg:aspect-auto lg:min-h-full">
						{#if imageSrc}
							<img
								src={imageSrc}
								alt=""
								class="h-full w-full object-contain"
								referrerpolicy="no-referrer"
							/>
						{:else}
							<div
								class="flex h-full min-h-48 items-center justify-center text-sm text-base-content/50"
							>
								Pas d’aperçu
							</div>
						{/if}
					</figure>
					<div class="card-body gap-4">
						<div class="flex flex-wrap items-start justify-between gap-3">
							<div class="min-w-0 flex-1">
								<h1 class="text-2xl font-bold leading-tight sm:text-3xl">{game.name}</h1>
								<p class="mt-1 text-sm text-base-content/60">
									Mis à jour le {new Date(game.updatedAt).toLocaleDateString('fr-FR')}
								</p>
							</div>
							<div class="flex flex-wrap gap-2">
								<span class={websiteBadgeClass()}>{game.websiteLabel}</span>
								{#if game.gameVersion?.trim()}
									<span class="badge badge-outline">{game.gameVersion.trim()}</span>
								{/if}
							</div>
						</div>

						{#if game.engineTypes.length > 0}
							<div class="flex flex-wrap gap-1">
								{#each game.engineTypes as engine (engine)}
									<span
										class="badge badge-sm badge-outline"
										style={`border-color: ${getGameEngineHexColor(engine)}; color: ${getGameEngineHexColor(engine)}`}
									>
										{engineDisplayLabel(engine)}
									</span>
								{/each}
							</div>
						{/if}

						{#if game.descriptionFr?.trim() || game.description?.trim()}
							<p class="whitespace-pre-wrap text-base-content/80">
								{game.descriptionFr?.trim() || game.description}
							</p>
							{#if game.descriptionFr?.trim() && game.description?.trim() && game.descriptionFr.trim() !== game.description.trim()}
								<details class="mt-3 text-sm text-base-content/70">
									<summary class="cursor-pointer font-medium">Description originale</summary>
									<p class="mt-2 whitespace-pre-wrap">{game.description}</p>
								</details>
							{/if}
						{/if}

						{#if game.tags.length > 0}
							<div class="flex flex-wrap gap-1">
								{#each game.tags as tag (tag)}
									<span class="badge badge-sm badge-ghost">{tag}</span>
								{/each}
							</div>
						{/if}

						<div class="card-actions justify-start pt-2">
							{#if game.link}
								<a
									href={game.link}
									target="_blank"
									rel="noopener noreferrer"
									class="btn btn-primary gap-2"
								>
									<ExternalLink class="h-4 w-4" />
									Voir le thread
								</a>
							{/if}
							{#if game.threadId}
								<span class="text-sm text-base-content/60 self-center">
									Thread #{game.threadId}
								</span>
							{/if}
						</div>
					</div>
				</div>
			</header>

			<section class="flex flex-col gap-4">
				<h2 class="text-xl font-bold">
					Traductions
					<span class="text-base font-normal text-base-content/60"
						>({game.translations.length})</span
					>
				</h2>

				{#if !game.translations.length}
					<div class="card border border-base-300 bg-base-100">
						<div class="card-body">
							<p class="text-base-content/70">Aucune traduction enregistrée pour ce jeu.</p>
						</div>
					</div>
				{:else}
					<div class="flex flex-col gap-3">
						{#each game.translations as tr (tr.id)}
							<div class="card border border-base-300 bg-base-100 shadow-sm">
								<div class="card-body gap-3">
									<div class="flex flex-wrap items-start justify-between gap-2">
										<h3 class="font-semibold">
											{tr.translationName?.trim() || game.name}
										</h3>
										<span class={translationStatusBadgeClass(tr.status)}>
											{progressDisplayLabel(tr.status)}
										</span>
									</div>

									<div class="flex flex-wrap gap-2 text-sm">
										<span class="badge badge-outline badge-sm">
											{translationTypeDisplayLabel(tr.ttype)}
										</span>
										<span class="badge badge-ghost badge-sm">
											{translationKindLabel(tr.tname)}
										</span>
										<span
											class="badge badge-sm badge-outline"
											style={`border-color: ${getGameEngineHexColor(tr.gameType)}; color: ${getGameEngineHexColor(tr.gameType)}`}
										>
											{engineDisplayLabel(tr.gameType)}
										</span>
										{#if tr.ac}
											<span class="badge badge-primary badge-sm">Auto-check</span>
										{/if}
									</div>

									<dl class="grid gap-2 text-sm sm:grid-cols-2">
										<div>
											<dt class="text-base-content/60">Version</dt>
											<dd class="flex flex-col items-start gap-1">
												<span
													class={translationVersionSyncBadgeClass(tr.isOutdated, tr.isIntegrated)}
												>
													{translationVersionSyncLabel(tr.isOutdated, tr.isIntegrated)}
												</span>
												{#if tr.isOutdated}
													<span class="text-xs text-base-content/70">
														Version attendue&nbsp;: {tr.referenceVersion?.trim() || '—'}
													</span>
												{/if}
											</dd>
										</div>
										<div>
											<dt class="text-base-content/60">Trad. ver.</dt>
											<dd class="font-medium">{tr.tversion?.trim() || '—'}</dd>
										</div>
										{#if tr.translatorName}
											<div>
												<dt class="text-base-content/60">Traducteur</dt>
												<dd class="font-medium">{tr.translatorName}</dd>
											</div>
										{/if}
										{#if tr.proofreaderName}
											<div>
												<dt class="text-base-content/60">Relecteur</dt>
												<dd class="font-medium">{tr.proofreaderName}</dd>
											</div>
										{/if}
									</dl>

									{#if tr.tlink?.trim()}
										<a
											href={tr.tlink}
											target="_blank"
											rel="noopener noreferrer"
											class="btn btn-outline btn-sm gap-2 w-fit"
										>
											<ExternalLink class="h-3.5 w-3.5" />
											Lien de traduction
										</a>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</section>

			{#if game.recentUpdates.length > 0}
				<section class="flex flex-col gap-3">
					<h2 class="text-xl font-bold">Activité récente</h2>
					<ul class="flex flex-col gap-2">
						{#each game.recentUpdates as item (item.id)}
							<li
								class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-base-300 bg-base-100 px-4 py-3"
							>
								<span class={updateStatusClass(item.status)}>{updateStatusLabel(item.status)}</span>
								<time class="text-sm text-base-content/60" datetime={item.createdAt.toISOString()}>
									{new Date(item.createdAt).toLocaleString('fr-FR')}
								</time>
							</li>
						{/each}
					</ul>
				</section>
			{/if}
		</article>
	{/if}
</main>
