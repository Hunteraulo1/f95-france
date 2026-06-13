<script lang="ts">
	import { enhance } from '$app/forms';
	import { replaceState } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/stores';
	import ServicesStatusCard from '$lib/components/dashboard/ServicesStatusCard.svelte';
	import { createFormEnhance } from '$lib/forms/enhance';
	import { onMount, tick } from 'svelte';
	import { get } from 'svelte/store';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	const canEditConfig = $derived(data.canEditConfig);
	const canManageMaintenance = $derived(data.canManageMaintenance);
	const canSave = $derived(data.canSave);

	let configError = $state<string | null>(null);
	let oauthMessage = $state<{ type: 'success' | 'error'; text: string } | null>(null);

	let appName = $state('');
	let maintenanceMode = $state(false);

	$effect(() => {
		appName = data.config?.appName ?? 'F95 France';
		maintenanceMode = Boolean(data.config?.maintenanceMode);
	});

	onMount(() => {
		const urlParams = new URLSearchParams(window.location.search);
		const oauthErr = urlParams.get('oauth_error');
		if (urlParams.get('oauth_success') === 'true') {
			oauthMessage = { type: 'success', text: 'Autorisation OAuth2 réussie !' };
		} else if (oauthErr) {
			oauthMessage = { type: 'error', text: `Erreur OAuth2: ${oauthErr}` };
		} else {
			return;
		}

		void tick().then(() => {
			setTimeout(() => {
				replaceState(resolve('/dashboard/config'), get(page).state);
			}, 0);
		});
	});
</script>

<section class="flex flex-col gap-8">
	<div class="flex flex-col gap-4">
		<h2 class="text-lg font-semibold text-base-content">Configuration de l'application</h2>
		{#if !canSave}
			<div role="alert" class="alert alert-info">
				<span
					>Accès en lecture seule — les modifications nécessitent les droits d’écriture appropriés.</span
				>
			</div>
		{/if}

		<ServicesStatusCard
			servicesStatus={data.servicesStatus}
			config={data.config}
			{canEditConfig}
			enableTestAll
		/>

		{#if oauthMessage}
			<div class={`alert ${oauthMessage.type === 'success' ? 'alert-success' : 'alert-error'}`}>
				<span>{oauthMessage.text}</span>
			</div>
		{/if}

		<div class="card w-full border border-base-300 bg-base-100 shadow-xl">
			<div class="card-body gap-6 sm:p-8">
				{#if configError}
					<div class="mb-4 alert alert-error">
						<span>{configError}</span>
					</div>
				{/if}
				<form
					method="POST"
					action="?/updateConfig"
					use:enhance={createFormEnhance({
						locked: !canSave,
						invalidateAll: true,
						onStart: () => {
							configError = null;
						},
						onFailure: (message) => {
							configError = message;
						}
					})}
				>
					<div class="flex flex-col gap-4">
						<div class="form-control w-full">
							<label for="appName" class="label">
								<span class="label-text text-wrap">Nom de l'application</span>
							</label>
							<input
								id="appName"
								name="appName"
								type="text"
								class="input-bordered input w-full"
								class:input-error={configError}
								bind:value={appName}
								required={canEditConfig}
								disabled={!canEditConfig}
								readonly={!canEditConfig}
							/>
						</div>
						<div class="divider">Sécurité / Accès</div>
						<div class="form-control w-full">
							<label
								for="maintenanceMode"
								class="label {canManageMaintenance ? 'cursor-pointer' : ''} justify-start gap-3"
							>
								<input
									id="maintenanceMode"
									name="maintenanceMode"
									type="checkbox"
									class="checkbox checkbox-sm"
									bind:checked={maintenanceMode}
									disabled={!canManageMaintenance}
								/>
								<span class="label-text text-wrap">
									Mode maintenance (bloque les utilisateurs sans « Contourner la maintenance »)
								</span>
							</label>
							{#if !canManageMaintenance}
								<p class="label-text-alt text-base-content/60">
									Droit « Activer la maintenance » requis pour modifier ce réglage.
								</p>
							{/if}
						</div>
						{#if canSave}
							<div class="form-control mt-4">
								<button type="submit" class="btn btn-primary">
									Enregistrer la configuration
								</button>
							</div>
						{/if}
					</div>
				</form>
			</div>
		</div>
	</div>
</section>
