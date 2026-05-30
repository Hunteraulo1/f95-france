<script lang="ts">
	import { enhance } from '$app/forms';
	import {
		mapAutoCheckResult,
		type AutoCheckManualResult
	} from '$lib/components/dashboard/dev/dev-page-mappers';
	import { createDevActionEnhance } from '$lib/forms/dev-action';
	import type { ConfigClientSafe } from '$lib/server/app-config';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import CircleX from '@lucide/svelte/icons/circle-x';
	import Loader from '@lucide/svelte/icons/loader';

	let { config }: { config: ConfigClientSafe | null | undefined } = $props();

	let isLoading = $state(false);
	let result = $state<AutoCheckManualResult | null>(null);
</script>

<div class="card w-full border border-base-300 bg-base-100 shadow-xl">
	<div class="card-body gap-6 sm:p-8">
		<h2 class="mb-4 card-title text-2xl">Exécution manuelle Auto-check</h2>
		<p class="mb-2 text-sm text-base-content/70">
			Dernier auto-check :
			{config?.autoCheckLastRunAt
				? new Date(config.autoCheckLastRunAt).toLocaleString('fr-FR')
				: 'jamais'}
		</p>
		<form
			method="POST"
			action="?/triggerAutoCheck"
			use:enhance={createDevActionEnhance({
				setLoading: (v) => {
					isLoading = v;
				},
				setResult: (v) => {
					result = v;
				},
				map: mapAutoCheckResult
			})}
		>
			<button type="submit" class="btn btn-outline" disabled={isLoading}>
				{#if isLoading}
					<Loader class="h-5 w-5 animate-spin" />
					<span>Exécution...</span>
				{:else}
					<span>Lancer un auto-check maintenant</span>
				{/if}
			</button>
		</form>
		{#if result}
			<div class="mt-4">
				{#if result.success}
					<div class="alert alert-success">
						<CircleCheck class="h-6 w-6" />
						<div class="flex-1">
							<h3 class="font-bold">{result.message}</h3>
							{#if result.details && typeof result.details === 'object'}
								<p class="mt-1 text-sm">
									Jeux scannés: {result.details.scannedGames} | Jeux mis à jour:
									{result.details.updatedGames} | Déjà alignés:
									{result.details.disabledAlignedGames} | Traductions impactées:
									{result.details.updatedTranslations} | Webhooks traducteurs:
									{result.details.translatorWebhooksSent ?? 0}
								</p>
							{:else if typeof result.details === 'string'}
								<p class="mt-1 text-sm">{result.details}</p>
							{/if}
						</div>
					</div>
				{:else}
					<div class="alert alert-error">
						<CircleX class="h-6 w-6" />
						<div class="flex-1">
							<h3 class="font-bold">{result.message || 'Erreur inconnue'}</h3>
							{#if result.details}
								<p class="mt-1 text-sm">
									{typeof result.details === 'string'
										? result.details
										: JSON.stringify(result.details)}
								</p>
							{/if}
						</div>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>
