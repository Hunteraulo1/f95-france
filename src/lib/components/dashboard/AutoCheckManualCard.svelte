<script lang="ts">
	import { enhance } from '$app/forms';
	import {
		mapAutoCheckResult,
		type AutoCheckManualResult
	} from '$lib/components/dashboard/dev/dev-page-mappers';
	import { actionDataRecord } from '$lib/forms/dev-action';
	import type { ConfigClientSafe } from '$lib/server/app-config';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import CircleX from '@lucide/svelte/icons/circle-x';
	import Loader from '@lucide/svelte/icons/loader';
	import Play from '@lucide/svelte/icons/play';

	let { config }: { config: ConfigClientSafe | null | undefined } = $props();

	let isLoading = $state(false);
	let result = $state<AutoCheckManualResult | null>(null);
</script>

<div class="card border border-base-300 bg-base-100 shadow-xl">
	<div class="card-body gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div class="flex-1">
			<h2 class="card-title text-lg">Exécution manuelle</h2>
			<p class="text-sm text-base-content/70">
				Dernier auto-check :
				{config?.autoCheckLastRunAt
					? new Date(config.autoCheckLastRunAt).toLocaleString('fr-FR')
					: 'jamais'}
			</p>
		</div>
		<form
			method="POST"
			action="?/triggerAutoCheck"
			use:enhance={() => {
				isLoading = true;
				result = null;
				return async ({ result: actionResult, update }) => {
					await update({ invalidateAll: true });
					isLoading = false;
					const data = actionDataRecord(actionResult);
					if (data) result = mapAutoCheckResult(data);
				};
			}}
		>
			<button type="submit" class="btn btn-primary" disabled={isLoading}>
				{#if isLoading}
					<Loader class="h-5 w-5 animate-spin" />
					Exécution…
				{:else}
					<Play size={18} />
					Lancer l’auto-check
				{/if}
			</button>
		</form>
	</div>
	{#if result}
		<div class="card-body pt-0">
			{#if result.success}
				<div class="alert alert-success">
					<CircleCheck class="h-6 w-6 shrink-0" />
					<div class="flex-1">
						<h3 class="font-bold">{result.message}</h3>
						{#if result.details && typeof result.details === 'object'}
							<p class="mt-1 text-sm">
								Jeux scannés : {result.details.scannedGames} · Mis à jour :
								{result.details.updatedGames} · Déjà alignés :
								{result.details.disabledAlignedGames} · Traductions :
								{result.details.updatedTranslations} · MP traducteurs :
								{result.details.translatorDmsSent ?? 0} · Webhooks traducteurs :
								{result.details.translatorWebhooksSent ?? 0}
							</p>
						{:else if typeof result.details === 'string'}
							<p class="mt-1 text-sm">{result.details}</p>
						{/if}
					</div>
				</div>
			{:else}
				<div class="alert alert-error">
					<CircleX class="h-6 w-6 shrink-0" />
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
