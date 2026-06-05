<script lang="ts">
	import ExtensionMockup from '$lib/components/ExtensionMockup.svelte';
	import {
		detectExtensionBrowserTarget,
		extensionAlternateDownloadHref,
		extensionAlternateDownloadLabel,
		extensionDownloadButtonLabel,
		extensionDownloadHint,
		extensionDownloadHref,
		type ExtensionBrowserTarget,
		type ExtensionDownloadUrls
	} from '$lib/extension-browser';
	import type { HomeExtensionMockupGame } from '$lib/home-extension-mockup';
	import Bell from '@lucide/svelte/icons/bell';
	import Download from '@lucide/svelte/icons/download';
	import Filter from '@lucide/svelte/icons/filter';
	import Languages from '@lucide/svelte/icons/languages';
	import Puzzle from '@lucide/svelte/icons/puzzle';
	import '$lib/styles/extension-mockup.css';
	import { onMount } from 'svelte';

	interface Props {
		games: HomeExtensionMockupGame[];
		extensionDownloads: ExtensionDownloadUrls;
		extensionBrowserTarget: ExtensionBrowserTarget;
	}

	let { games, extensionDownloads, extensionBrowserTarget: serverTarget }: Props = $props();

	let clientTarget = $state<ExtensionBrowserTarget | null>(null);

	onMount(() => {
		clientTarget = detectExtensionBrowserTarget(navigator.userAgent);
	});

	const browserTarget = $derived(clientTarget ?? serverTarget);
	const downloadHref = $derived(extensionDownloadHref(browserTarget, extensionDownloads));
	const downloadLabel = $derived(extensionDownloadButtonLabel(browserTarget));
	const downloadHint = $derived(extensionDownloadHint(browserTarget));
	const alternateHref = $derived(extensionAlternateDownloadHref(browserTarget, extensionDownloads));
	const alternateLabel = $derived(extensionAlternateDownloadLabel(browserTarget));
</script>

<div
	class="card card-border w-full overflow-hidden bg-base-100 shadow-sm lg:card-side lg:flex-row"
	aria-labelledby="extension-promo-title"
>
	<div class="relative block w-full lg:contents">
		<figure
			class="pointer-events-none flex items-center justify-center overflow-hidden bg-linear-to-br from-base-200 via-base-300/40 to-base-200 absolute max-lg:inset-0 min-h-full opacity-25 lg:pointer-events-auto lg:relative lg:z-auto lg:min-h-80 lg:min-w-[42%] lg:shrink-0 lg:p-8 lg:opacity-100"
		>
			<div
				class="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_70%_50%,color-mix(in_oklab,var(--color-secondary)_22%,transparent),transparent_65%)] bg-base-300"
			></div>
			<div class="relative shrink-0 origin-center max-lg:scale-60 -translate-y-4">
				<ExtensionMockup {games} />
			</div>
		</figure>

		<div
			class="card-body relative z-10 flex flex-col justify-center gap-5 p-6 sm:p-8 lg:max-w-[58%] lg:flex-1"
		>
			<div class="badge badge-secondary badge-outline w-fit gap-1.5">
				<Puzzle class="size-3.5" aria-hidden="true" />
				Extension F95 France
			</div>
			<div class="space-y-3">
				<h2 id="extension-promo-title" class="text-2xl font-bold leading-tight sm:text-3xl">
					Vos traductions françaises, directement sur F95zone
				</h2>
				<p class="text-base text-base-content/70">
					L’extension enrichit les fils F95zone et LewdCorner : statut des traductions, filtres
					puissants, notifications et lien avec le site F95 France.
				</p>
			</div>
			<ul
				class="grid gap-2 text-sm text-base-content/80 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2"
			>
				<li class="flex items-start gap-2">
					<Languages class="mt-0.5 size-4 shrink-0 text-secondary" aria-hidden="true" />
					<span>Repères visuels des jeux déjà traduits en VF</span>
				</li>
				<li class="flex items-start gap-2">
					<Filter class="mt-0.5 size-4 shrink-0 text-secondary" aria-hidden="true" />
					<span>Filtres avancés sur les listes de jeux et mises à jour</span>
				</li>
				<li class="flex items-start gap-2 sm:col-span-2 lg:col-span-1 xl:col-span-2">
					<Bell class="mt-0.5 size-4 shrink-0 text-secondary" aria-hidden="true" />
					<span>Alertes et raccourcis sans quitter le forum</span>
				</li>
			</ul>
			<div class="flex flex-col gap-3 pt-1">
				<div class="flex flex-wrap items-center gap-3">
					<a
						href={downloadHref}
						target="_blank"
						rel="noopener noreferrer"
						class="btn btn-secondary gap-2"
						draggable="false"
					>
						<Download class="size-4" aria-hidden="true" />
						{downloadLabel}
					</a>
					<span class="text-xs text-base-content/50">{downloadHint}</span>
				</div>

				{#if browserTarget === 'chromium'}
					<div
						class="rounded-lg border border-base-300 bg-base-200/60 p-3 text-sm text-base-content"
					>
						<p class="mb-2 font-medium text-secondary">
							Installation sur Chrome / Edge / Brave / Opera
						</p>
						<ol class="list-decimal space-y-1.5 ps-4 text-xs leading-relaxed">
							<li>
								Ouvrez la page des extensions : <code
									class="rounded bg-base-300 px-1 py-0.5 text-[0.7rem]">chrome://extensions/</code
								>
							</li>
							<li>Activez le <span class="font-medium">Mode développeur</span> en haut à droite</li>
							<li>
								Glissez l’archive <span class="font-medium">.zip</span> téléchargée dans la page
							</li>
						</ol>
					</div>
				{/if}

				{#if alternateHref && alternateLabel}
					<p class="text-xs text-base-content/55">
						<a
							href={alternateHref}
							target="_blank"
							rel="noopener noreferrer"
							class="link link-hover text-base-content/70"
							draggable="false"
						>
							{alternateLabel}
						</a>
					</p>
				{/if}

				{#if browserTarget === 'unknown'}
					<div class="flex flex-wrap gap-2">
						<a
							href={extensionDownloads.firefox}
							target="_blank"
							rel="noopener noreferrer"
							class="btn btn-outline btn-sm"
							draggable="false"
						>
							Firefox (.xpi)
						</a>
						<a
							href={extensionDownloads.chromium}
							target="_blank"
							rel="noopener noreferrer"
							class="btn btn-outline btn-sm"
							draggable="false"
						>
							Chrome / Edge (.zip)
						</a>
						<a
							href={extensionDownloads.page}
							target="_blank"
							rel="noopener noreferrer"
							class="btn btn-ghost btn-sm"
							draggable="false"
						>
							Page des releases
						</a>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>
