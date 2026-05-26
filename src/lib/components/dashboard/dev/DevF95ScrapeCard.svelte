<script lang="ts">
	import { enhance } from '$app/forms';
	import { createDevActionEnhance } from '$lib/forms/dev-action';
	import {
		isScrapeDetailsObject,
		mapScrapeResult,
		type ScrapeResult
	} from '$lib/components/dashboard/dev/dev-page-mappers';
	import { resolveGameImageSrc } from '$lib/utils/game-image-url';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import CircleX from '@lucide/svelte/icons/circle-x';
	import Loader from '@lucide/svelte/icons/loader';
	import Table2 from '@lucide/svelte/icons/table-2';

	let isLoading = $state(false);
	let scrapeResult = $state<ScrapeResult | null>(null);
</script>

<div class="card w-full border border-base-300 bg-base-100 shadow-xl">
	<div class="card-body gap-6 sm:p-8">
		<h2 class="mb-4 card-title text-2xl">Test de récupération F95</h2>

		<p class="mb-4 text-base-content/70">
			Scrape un thread F95 pour vérifier les données récupérées automatiquement (nom, version,
			tags, image, etc.). Seuls les threads F95 sont supportés pour le moment.
		</p>

		<form
			method="POST"
			action="?/testScrape"
			use:enhance={createDevActionEnhance({
				setLoading: (v) => {
					isLoading = v;
				},
				setResult: (v) => {
					scrapeResult = v;
				},
				map: mapScrapeResult
			})}
		>
			<div class="grid gap-4 md:grid-cols-3">
				<div class="form-control md:col-span-2">
					<label for="threadId" class="label">
						<span class="label-text">ID du thread F95</span>
					</label>
					<input
						id="threadId"
						name="threadId"
						type="number"
						min="1"
						class="input-bordered input w-full"
						placeholder="Ex: 26002"
						required
						disabled={isLoading}
					/>
				</div>
				<div class="form-control">
					<label for="website" class="label">
						<span class="label-text">Plateforme</span>
					</label>
					<select
						id="website"
						name="website"
						class="select-bordered select w-full"
						required
						disabled={isLoading}
					>
						<option value="f95z" selected>F95Zone</option>
						<option value="lc" disabled>LewdCorner (bientôt)</option>
					</select>
				</div>
			</div>
			<div class="form-control mt-4">
				<button type="submit" class="btn btn-secondary" disabled={isLoading}>
					{#if isLoading}
						<Loader class="h-5 w-5 animate-spin" />
						<span>Scrape en cours...</span>
					{:else}
						<Table2 class="h-4 w-4" />
						<span>Lancer le scrape</span>
					{/if}
				</button>
			</div>
		</form>

		{#if scrapeResult}
			<div class="mt-6">
				{#if scrapeResult.success}
					<div class="alert alert-success">
						<CircleCheck class="h-6 w-6" />
						<div class="flex-1">
							<h3 class="font-bold">{scrapeResult.message}</h3>
							{#if isScrapeDetailsObject(scrapeResult.details)}
								{@const details = scrapeResult.details}
								<div class="mt-2 grid gap-4 md:grid-cols-2">
									<div class="space-y-1 text-sm">
										{#if details.name}
											<p><strong>Nom :</strong> {details.name}</p>
										{/if}
										{#if details.version}
											<p><strong>Version :</strong> {details.version}</p>
										{/if}
										{#if details.status}
											<p><strong>Statut :</strong> {details.status}</p>
										{/if}
										{#if details.type}
											<p><strong>Moteur :</strong> {details.type}</p>
										{/if}
										{#if details.tags}
											<p class="whitespace-pre-wrap">
												<strong>Tags :</strong>
												{details.tags}
											</p>
										{/if}
									</div>
									{#if details.image}
										<div class="flex justify-center">
											<img
												src={resolveGameImageSrc(details.image)}
												alt="Aperçu"
												class="h-40 w-28 rounded-lg object-cover shadow"
												loading="lazy"
												referrerpolicy="no-referrer"
											/>
										</div>
									{/if}
								</div>
							{:else if scrapeResult.details}
								<p class="mt-1 text-sm">{scrapeResult.details}</p>
							{/if}
						</div>
					</div>
				{:else}
					<div class="alert alert-error">
						<CircleX class="h-6 w-6" />
						<div class="flex-1">
							<h3 class="font-bold">{scrapeResult.message || 'Erreur inconnue'}</h3>
							{#if scrapeResult.details}
								{#if typeof scrapeResult.details === 'string'}
									<p class="mt-1 text-sm">{scrapeResult.details}</p>
								{:else}
									<pre class="mt-1 text-xs whitespace-pre-wrap">{JSON.stringify(
											scrapeResult.details,
											null,
											2
										)}</pre>
								{/if}
							{:else if !scrapeResult.message}
								<p class="mt-1 text-sm">Aucun détail disponible</p>
							{/if}
						</div>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>
