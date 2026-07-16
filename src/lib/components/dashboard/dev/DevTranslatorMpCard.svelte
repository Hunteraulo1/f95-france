<script lang="ts">
	import { enhance } from '$app/forms';
	import { createDevActionEnhance } from '$lib/forms/dev-action';
	import {
		mapTranslatorMpTestResult,
		type TranslatorMpTestResult
	} from '$lib/components/dashboard/dev/dev-page-mappers';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import CircleX from '@lucide/svelte/icons/circle-x';
	import Loader from '@lucide/svelte/icons/loader';

	export type BotTranslator = { id: string; name: string };

	let {
		discordBotConfigured,
		botTranslators
	}: { discordBotConfigured: boolean; botTranslators: BotTranslator[] } = $props();

	let isLoading = $state(false);
	let result = $state<TranslatorMpTestResult | null>(null);

	const noTranslators = $derived(botTranslators.length === 0);

	const methodLabels: Record<string, string> = {
		dm: 'MP Discord',
		channel_fallback: 'Repli sur le canal'
	};
</script>

<div class="card w-full border border-base-300 bg-base-100 shadow-xl">
	<div class="card-body gap-6 sm:p-8">
		<h2 class="mb-4 card-title text-2xl">Test MP traducteur (Auto-Check)</h2>
		<p class="mb-4 text-base-content/70">
			Envoie un MP Discord de test au traducteur choisi via le bot (<code class="text-xs"
				>DISCORD_BOT_TOKEN</code
			>). Si le MP est impossible (MP fermés, bot bloqué, ou bot non configuré), le message est
			envoyé en repli sur le canal Discord « Traducteurs » — exactement le comportement utilisé par
			l'auto-check.
		</p>

		<div class="mb-4 flex items-center justify-between rounded-lg bg-base-200 px-3 py-2 text-sm">
			<span>Bot Discord</span>
			{#if discordBotConfigured}
				<span class="badge badge-sm badge-success">configuré</span>
			{:else}
				<span class="badge badge-ghost badge-sm">vide</span>
			{/if}
		</div>

		{#if !discordBotConfigured}
			<p class="mb-4 text-sm text-warning">
				<code class="text-xs">DISCORD_BOT_TOKEN</code> n'est pas défini : le test tombera directement
				en repli sur le canal, ce qui reste une façon valide de vérifier ce chemin.
			</p>
		{/if}

		{#if noTranslators}
			<p class="mb-4 text-sm text-warning">
				Aucun traducteur avec un compte Discord lié (<code class="text-xs">discordId</code>) —
				renseignez-en un pour pouvoir tester le MP.
			</p>
		{/if}

		<form
			method="POST"
			action="?/testTranslatorMp"
			use:enhance={createDevActionEnhance({
				setLoading: (v) => {
					isLoading = v;
				},
				setResult: (v) => {
					result = v;
				},
				map: mapTranslatorMpTestResult
			})}
		>
			<div class="flex flex-col gap-4 sm:flex-row sm:items-end">
				<div class="form-control flex-1">
					<label for="translatorId" class="label">
						<span class="label-text">Traducteur</span>
					</label>
					<select
						id="translatorId"
						name="translatorId"
						class="select-bordered select w-full max-w-md"
						disabled={isLoading || noTranslators}
					>
						{#each botTranslators as translator (translator.id)}
							<option value={translator.id}>{translator.name}</option>
						{/each}
					</select>
				</div>
				<button type="submit" class="btn btn-primary" disabled={isLoading || noTranslators}>
					{#if isLoading}
						<Loader class="h-5 w-5 animate-spin" />
						<span>Envoi…</span>
					{:else}
						<span>Envoyer un MP de test</span>
					{/if}
				</button>
			</div>
		</form>

		{#if result}
			<div class="mt-4">
				{#if result.success}
					<div class="alert alert-success">
						<CircleCheck class="h-6 w-6" />
						<div class="flex-1">
							<h3 class="font-bold">{result.message}</h3>
							{#if result.method}
								<p class="mt-1 text-sm opacity-80">
									Méthode : {methodLabels[result.method] ?? result.method}
								</p>
							{/if}
						</div>
					</div>
				{:else}
					<div class="alert alert-error">
						<CircleX class="h-6 w-6" />
						<div class="flex-1">
							<h3 class="font-bold">{result.message}</h3>
							{#if result.details}
								<pre
									class="mt-2 max-h-40 overflow-auto text-xs whitespace-pre-wrap">{result.details}</pre>
							{/if}
						</div>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>
