<script lang="ts">
	import { enhance } from '$app/forms';
	import { createDevActionEnhance } from '$lib/forms/dev-action';
	import {
		mapWebhookTestResult,
		type WebhookTestResult
	} from '$lib/components/dashboard/dev/dev-page-mappers';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import CircleX from '@lucide/svelte/icons/circle-x';
	import Loader from '@lucide/svelte/icons/loader';

	export type WebhookStatus = {
		updates: boolean;
		translators: boolean;
		admin: boolean;
	};

	let { webhookStatus }: { webhookStatus: WebhookStatus } = $props();

	let isLoading = $state(false);
	let result = $state<WebhookTestResult | null>(null);

	const webhookChannelLabels: Record<string, string> = {
		updates: 'Mises à jour',
		translators: 'Traducteurs',
		admin: 'Admin'
	};
	const webhookChannelLabel = (c: string) => webhookChannelLabels[c] ?? c;

	const noWebhookConfigured = $derived(
		!webhookStatus.updates && !webhookStatus.translators && !webhookStatus.admin
	);
</script>

<div class="card w-full border border-base-300 bg-base-100 shadow-xl">
	<div class="card-body gap-6 sm:p-8">
		<h2 class="mb-4 card-title text-2xl">Test des webhooks Discord</h2>
		<p class="mb-4 text-base-content/70">
			Envoie un embed de test sur l’URL enregistrée dans
			<a href="/dashboard/config" class="link link-primary">les paramètres</a> pour vérifier que le salon
			reçoit bien les messages.
		</p>

		<div class="mb-4 grid gap-2 text-sm sm:grid-cols-2">
			<div class="flex items-center justify-between rounded-lg bg-base-200 px-3 py-2">
				<span>Mises à jour</span>
				{#if webhookStatus.updates}
					<span class="badge badge-sm badge-success">configuré</span>
				{:else}
					<span class="badge badge-ghost badge-sm">vide</span>
				{/if}
			</div>
			<div class="flex items-center justify-between rounded-lg bg-base-200 px-3 py-2">
				<span>Traducteurs</span>
				{#if webhookStatus.translators}
					<span class="badge badge-sm badge-success">configuré</span>
				{:else}
					<span class="badge badge-ghost badge-sm">vide</span>
				{/if}
			</div>
			<div class="flex items-center justify-between rounded-lg bg-base-200 px-3 py-2">
				<span>Relecteurs</span>
				{#if webhookStatus.admin}
					<span class="badge badge-sm badge-success">configuré</span>
				{:else}
					<span class="badge badge-ghost badge-sm">vide</span>
				{/if}
			</div>
		</div>

		{#if noWebhookConfigured}
			<p class="mb-4 text-sm text-warning">
				Aucune variable <code class="text-xs">DISCORD_WEBHOOK_*</code> définie sur le serveur :
				ajoutez-en au moins une (voir
				<a href="/dashboard/config" class="link link-primary">Configuration</a>) pour pouvoir
				tester.
			</p>
		{/if}

		<form
			method="POST"
			action="?/testDiscordWebhook"
			use:enhance={createDevActionEnhance({
				setLoading: (v) => {
					isLoading = v;
				},
				setResult: (v) => {
					result = v;
				},
				map: mapWebhookTestResult
			})}
		>
			<div class="flex flex-col gap-4 sm:flex-row sm:items-end">
				<div class="form-control flex-1">
					<label for="webhookChannel" class="label">
						<span class="label-text">Canal</span>
					</label>
					<select
						id="webhookChannel"
						name="channel"
						class="select-bordered select w-full max-w-md"
						disabled={isLoading || noWebhookConfigured}
					>
						{#if webhookStatus.updates}<option value="updates">Mises à jour</option>{/if}
						{#if webhookStatus.translators}<option value="translators">Traducteurs</option>{/if}
						{#if webhookStatus.admin}<option value="admin">Admin</option>{/if}
					</select>
				</div>
				<button type="submit" class="btn btn-primary" disabled={isLoading || noWebhookConfigured}>
					{#if isLoading}
						<Loader class="h-5 w-5 animate-spin" />
						<span>Envoi…</span>
					{:else}
						<span>Envoyer un message de test</span>
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
							{#if result.channel}
								<p class="mt-1 text-sm opacity-80">
									Canal : {webhookChannelLabel(result.channel)}
									{#if result.httpStatus != null}
										· HTTP {result.httpStatus}
									{/if}
								</p>
							{/if}
						</div>
					</div>
				{:else}
					<div class="alert alert-error">
						<CircleX class="h-6 w-6" />
						<div class="flex-1">
							<h3 class="font-bold">{result.message}</h3>
							{#if result.channel}
								<p class="mt-1 text-sm">
									Canal : {webhookChannelLabel(result.channel)}
									{#if result.httpStatus != null}
										· HTTP {result.httpStatus}
									{/if}
								</p>
							{/if}
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
