<script lang="ts">
	import { enhance } from '$app/forms';
	import { replaceState } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	let configError = $state<string | null>(null);
	let oauthMessage = $state<{ type: 'success' | 'error'; text: string } | null>(null);

	onMount(() => {
		// Vérifier les paramètres d'URL pour les messages OAuth2
		const urlParams = new URLSearchParams(window.location.search);
		if (urlParams.get('oauth_success') === 'true') {
			oauthMessage = { type: 'success', text: 'Autorisation OAuth2 réussie !' };
			// Nettoyer l'URL
			replaceState('/dashboard/config', get(page).state);
		} else if (urlParams.get('oauth_error')) {
			oauthMessage = { type: 'error', text: `Erreur OAuth2: ${urlParams.get('oauth_error')}` };
			replaceState('/dashboard/config', get(page).state);
		}
	});
</script>

<section class="flex flex-col gap-8">
	<!-- Configuration de l'application -->
	<div class="flex flex-col gap-4">
		<h2 class="text-lg font-semibold text-base-content">Configuration de l'application</h2>

		<div class="card bg-base-100 p-8 shadow-sm">
			{#if configError}
				<div class="mb-4 alert alert-error">
					<span>{configError}</span>
				</div>
			{/if}

			<form
				method="POST"
				action="?/updateConfig"
				use:enhance={() => {
					configError = null;
					return async function ({ result, update }) {
						if (result.type === 'success') {
							await update();
							configError = null;
						} else if (result.type === 'failure' && result.data) {
							const message =
								typeof result.data === 'object' && 'message' in result.data
									? String(result.data.message)
									: 'Erreur lors de la mise à jour';
							configError = message;
						}
					};
				}}
			>
				<div class="flex flex-col gap-4">
					<div class="form-control w-full">
						<label for="appName" class="label">
							<span class="label-text">Nom de l'application</span>
						</label>
						<input
							id="appName"
							name="appName"
							type="text"
							class="input-bordered input w-full"
							class:input-error={configError}
							value={data.config?.appName || 'F95 France'}
							required
						/>
					</div>

					<div class="divider">Sécurité / Accès</div>

					<div class="form-control w-full">
						<label for="maintenanceMode" class="label cursor-pointer justify-start gap-3">
							<input
								id="maintenanceMode"
								name="maintenanceMode"
								type="checkbox"
								class="checkbox checkbox-sm"
								checked={Boolean(data.config?.maintenanceMode)}
							/>
							<span class="label-text">
								Mode maintenance (bloque tous les utilisateurs sauf superadmin)
							</span>
						</label>
					</div>

					<div class="divider">Webhooks Discord</div>

					<div class="form-control w-full">
						<label for="discordWebhookUpdates" class="label">
							<span class="label-text">Webhook Discord - Updates</span>
						</label>
						<input
							id="discordWebhookUpdates"
							name="discordWebhookUpdates"
							type="url"
							class="input-bordered input w-full"
							value={data.config?.discordWebhookUpdates || ''}
							placeholder="https://discord.com/api/webhooks/..."
						/>
					</div>

					<div class="form-control w-full">
						<label for="discordWebhookTranslators" class="label">
							<span class="label-text">Webhook Discord - Translators</span>
						</label>
						<input
							id="discordWebhookTranslators"
							name="discordWebhookTranslators"
							type="url"
							class="input-bordered input w-full"
							value={data.config?.discordWebhookTranslators || ''}
							placeholder="https://discord.com/api/webhooks/..."
						/>
					</div>

					<div class="form-control w-full">
						<label for="discordWebhookProofreaders" class="label">
							<span class="label-text">Webhook Discord - Proofreaders</span>
						</label>
						<input
							id="discordWebhookProofreaders"
							name="discordWebhookProofreaders"
							type="url"
							class="input-bordered input w-full"
							value={data.config?.discordWebhookProofreaders || ''}
							placeholder="https://discord.com/api/webhooks/..."
						/>
					</div>

					<div class="divider">Google Sheets</div>

					<div class="form-control w-full">
						<label for="googleSpreadsheetId" class="label">
							<span class="label-text">ID du Spreadsheet Google</span>
						</label>
						<input
							id="googleSpreadsheetId"
							name="googleSpreadsheetId"
							type="text"
							class="input-bordered input w-full"
							value={data.config?.googleSpreadsheetId || ''}
							placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
						/>
					</div>

					<div class="form-control w-full">
						<label for="googleApiKey" class="label">
							<span class="label-text">Clé API Google (optionnel si OAuth2 est configuré)</span>
						</label>
						<input
							id="googleApiKey"
							name="googleApiKey"
							type="password"
							class="input-bordered input w-full"
							value={data.config?.googleApiKey || ''}
							placeholder="AIzaSy..."
						/>
						<label class="label" for="googleApiKey">
							<span class="label-text-alt text-base-content/50">
								Requis pour accéder aux spreadsheets via l'API.
								<a
									href="https://console.cloud.google.com/apis/credentials"
									target="_blank"
									rel="noopener noreferrer"
									class="link link-primary"
								>
									Créer une clé API
								</a>
							</span>
						</label>
					</div>

					<div class="form-control w-full">
						<label for="googleOAuthClientId" class="label">
							<span class="label-text">Client ID OAuth2</span>
						</label>
						<input
							id="googleOAuthClientId"
							name="googleOAuthClientId"
							type="text"
							class="input-bordered input w-full"
							value={data.config?.googleOAuthClientId || ''}
							placeholder="xxxxx.apps.googleusercontent.com"
						/>
					</div>

					<div class="form-control w-full">
						<label for="googleOAuthClientSecret" class="label">
							<span class="label-text">Client Secret OAuth2</span>
						</label>
						<input
							id="googleOAuthClientSecret"
							name="googleOAuthClientSecret"
							type="password"
							class="input-bordered input w-full"
							value={data.config?.googleOAuthClientSecret || ''}
							placeholder="GOCSPX-..."
						/>
					</div>

					{#if data.config?.googleOAuthClientId && data.config?.googleOAuthClientSecret}
						<div class="mb-4 rounded-lg bg-base-200 p-4">
							<p class="mb-2 text-sm font-semibold">
								URI de redirection à configurer dans Google Cloud Console :
							</p>
							<code class="rounded bg-base-300 px-2 py-1 text-xs break-all">
								{typeof window !== 'undefined'
									? `${window.location.origin}/api/google-oauth/callback`
									: 'Chargement...'}
							</code>
							<p class="mt-2 text-xs text-base-content/70">
								⚠️ Cette URI doit être exactement la même dans Google Cloud Console → Identifiants
								OAuth 2.0 → URI de redirection autorisées
							</p>
						</div>

						<div class="form-control w-full">
							<a href="/api/google-oauth/authorize" class="btn btn-outline btn-primary">
								Autoriser avec Google
							</a>
							<div class="label">
								<span class="label-text-alt text-base-content/50">
									{#if data.config?.googleOAuthAccessToken}
										<span class="text-success">✓ Authentifié</span>
									{:else}
										Cliquez pour autoriser l'accès à Google Sheets
									{/if}
								</span>
							</div>
						</div>
					{/if}

					{#if oauthMessage}
						<div
							class={`alert ${oauthMessage.type === 'success' ? 'alert-success' : 'alert-error'}`}
						>
							<span>{oauthMessage.text}</span>
						</div>
					{/if}

					<div class="form-control mt-4">
						<button type="submit" class="btn btn-primary"> Enregistrer la configuration </button>
					</div>
				</div>
			</form>
		</div>
	</div>
</section>
