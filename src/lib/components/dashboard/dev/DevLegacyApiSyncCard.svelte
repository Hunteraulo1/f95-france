<script lang="ts">
	import { enhance } from '$app/forms';
	import { createDevActionEnhance } from '$lib/forms/dev-action';
	import {
		mapDbSheetSyncResult,
		type DbSheetSyncResult
	} from '$lib/components/dashboard/dev/dev-page-mappers';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import CircleX from '@lucide/svelte/icons/circle-x';
	import Loader from '@lucide/svelte/icons/loader';

	let dbSheetSyncIsLoading = $state(false);
	let dbSheetSyncResult = $state<DbSheetSyncResult | null>(null);
</script>

<div class="card w-full border border-base-300 bg-base-100 shadow-xl">
	<div class="card-body gap-6 sm:p-8">
		<h2 class="mb-4 card-title text-2xl">Synchronisation API legacy</h2>
		<p class="mb-4 text-base-content/70">
			Exporte les traductions et traducteurs de la base vers le Google Spreadsheet configuré.
		</p>
		<form
			method="POST"
			action="?/syncDbToSpreadsheet"
			use:enhance={createDevActionEnhance({
				setLoading: (v) => {
					dbSheetSyncIsLoading = v;
				},
				setResult: (v) => {
					dbSheetSyncResult = v;
				},
				map: mapDbSheetSyncResult
			})}
		>
			<button type="submit" class="btn btn-secondary" disabled={dbSheetSyncIsLoading}>
				{#if dbSheetSyncIsLoading}
					<Loader class="h-5 w-5 animate-spin" />
					<span>Sync DB → Spreadsheet…</span>
				{:else}
					<span>Synchroniser DB vers Spreadsheet</span>
				{/if}
			</button>
		</form>
		{#if dbSheetSyncResult}
			{#if dbSheetSyncResult.success}
				<div class="alert alert-success">
					<CircleCheck class="h-6 w-6" />
					<div class="flex-1">
						<h3 class="font-bold">{dbSheetSyncResult.message}</h3>
						{#if dbSheetSyncResult.details && typeof dbSheetSyncResult.details === 'object'}
							<p class="mt-1 text-sm">
								Traductions : {dbSheetSyncResult.details.syncedTranslations}/{dbSheetSyncResult
									.details.totalTranslations}
								| Traducteurs : {dbSheetSyncResult.details.syncedTranslators}/{dbSheetSyncResult
									.details.totalTranslators}
								| Lignes Jeux supprimées (absentes de la DB) : {dbSheetSyncResult.details
									.prunedJeuxRows ?? 0}
							</p>
						{/if}
					</div>
				</div>
			{:else}
				<div class="alert alert-error">
					<CircleX class="h-6 w-6" />
					<div class="flex-1">
						<h3 class="font-bold">{dbSheetSyncResult.message || 'Erreur inconnue'}</h3>
						{#if dbSheetSyncResult.details}
							{#if typeof dbSheetSyncResult.details === 'string'}
								<p class="mt-1 text-sm">{dbSheetSyncResult.details}</p>
							{:else}
								<p class="mt-1 text-sm">
									Traductions : {dbSheetSyncResult.details.syncedTranslations}/{dbSheetSyncResult
										.details.totalTranslations}
									| Traducteurs : {dbSheetSyncResult.details.syncedTranslators}/{dbSheetSyncResult
										.details.totalTranslators}
									| Lignes Jeux supprimées : {dbSheetSyncResult.details.prunedJeuxRows ?? 0}
								</p>
								{#if dbSheetSyncResult.details.errors.length > 0}
									<pre
										class="mt-2 max-h-40 overflow-auto text-xs whitespace-pre-wrap">{dbSheetSyncResult.details.errors.join(
											'\n'
										)}</pre>
								{/if}
							{/if}
						{/if}
					</div>
				</div>
			{/if}
		{/if}
	</div>
</div>
