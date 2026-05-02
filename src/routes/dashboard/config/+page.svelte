<script lang="ts">
	import { enhance } from '$app/forms';
	import { replaceState } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/stores';
	import { onMount, tick } from 'svelte';
	import { get } from 'svelte/store';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	let configError = $state<string | null>(null);
	let oauthMessage = $state<{ type: 'success' | 'error'; text: string } | null>(null);

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

		// replaceState trop tôt pendant l’hydratation lève « router is not initialized » — différer.
		void tick().then(() => {
			setTimeout(() => {
				replaceState(resolve('/dashboard/config'), get(page).state);
			}, 0);
		});
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
							<span class="label-text text-wrap">Nom de l'application</span>
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
							<span class="label-text text-wrap">
								Mode maintenance (bloque tous les utilisateurs sauf superadmin)
							</span>
						</label>
					</div>

					<div class="divider">Auto-check F95</div>

					<div class="form-control w-full">
						<label for="autoCheckIntervalMinutes" class="label">
							<span class="label-text text-wrap">Délai entre 2 vérifications (minutes)</span>
						</label>
						<input
							id="autoCheckIntervalMinutes"
							name="autoCheckIntervalMinutes"
							type="number"
							min="5"
							max="1440"
							step="1"
							class="input-bordered input w-full"
							value={String(data.config?.autoCheckIntervalMinutes ?? 360)}
						/>
						<label class="label" for="autoCheckIntervalMinutes">
							<span class="label-text-alt text-base-content/60">
								Entre 5 min et 24h. Le cron passe régulièrement, mais n'exécute l'auto-check que si
								ce délai est écoulé.
							</span>
						</label>
					</div>
					<div class="form-control w-full">
						<label for="autoCheckReferenceTime" class="label">
							<span class="label-text text-wrap">Heure de référence (HH:mm)</span>
						</label>
						<input
							id="autoCheckReferenceTime"
							name="autoCheckReferenceTime"
							type="time"
							step="60"
							class="input-bordered input w-full"
							value={data.config?.autoCheckReferenceTime || '00:00'}
						/>
						<label class="label" for="autoCheckReferenceTime">
							<span class="label-text-alt text-base-content/60">
								L'intervalle démarre à partir de cette heure (ex: 03:00 avec 360 min => 03:00,
								09:00, 15:00, 21:00).
							</span>
						</label>
					</div>

					<div class="divider">Secrets (variables d’environnement)</div>

					<div class="alert text-sm alert-info">
						<div class="flex flex-col gap-2 text-wrap">
							<p>
								Les webhooks Discord, la clé API Google et les identifiants OAuth2 ne sont plus
								enregistrés dans la base : définissez-les sur le serveur (Vercel → Settings →
								Environment Variables) ou dans un fichier <code class="text-xs">.env</code> local.
							</p>
							<ul class="list-inside list-disc text-xs opacity-90">
								<li><code>DISCORD_WEBHOOK_UPDATES</code></li>
								<li><code>DISCORD_WEBHOOK_TRANSLATORS</code></li>
								<li><code>DISCORD_WEBHOOK_PROOFREADERS</code> (canal admin)</li>
								<li><code>DISCORD_WEBHOOK_LOGS</code> (optionnel)</li>
								<li><code>GOOGLE_API_KEY</code> (si pas uniquement OAuth)</li>
								<li>
									<code>GOOGLE_OAUTH_CLIENT_ID</code> et <code>GOOGLE_OAUTH_CLIENT_SECRET</code>
								</li>
								<li>
									<code>GOOGLE_SPREADSHEET_ID</code> (optionnel ; sinon l’ID ci-dessous en base)
								</li>
								<li>
									<code>CONFIG_TOKEN_ENCRYPTION_KEY</code> — base64 de 32 octets ; chiffre les jetons
									OAuth stockés en base
								</li>
							</ul>
							<p class="text-xs opacity-80">
								Source actuelle (indicatif) — Updates :
								<span class="badge badge-ghost badge-sm"
									>{data.config?.secretSources.discordUpdates}</span
								>
								· Translators :
								<span class="badge badge-ghost badge-sm"
									>{data.config?.secretSources.discordTranslators}</span
								>
								· Admin :
								<span class="badge badge-ghost badge-sm"
									>{data.config?.secretSources.discordProofreaders}</span
								>
								· Clé API :
								<span class="badge badge-ghost badge-sm"
									>{data.config?.secretSources.googleApiKey}</span
								>
								· OAuth client :
								<span class="badge badge-ghost badge-sm"
									>{data.config?.secretSources.googleOAuthClient}</span
								>
							</p>
							<p class="text-xs opacity-90">
								<span class="font-medium">Google OAuth (session)</span> —
								{#if data.config?.hasGoogleOAuthToken}
									<span class="badge badge-sm badge-success">jetons enregistrés</span>
								{:else}
									<span class="badge badge-ghost badge-sm">pas encore d’autorisation</span>
								{/if}
								<span class="mx-1 opacity-50">·</span>
								<span class="font-medium">Stockage en base</span> —
								{#if data.config?.tokenEncryptionActive}
									<span class="badge badge-sm badge-success"
										>chiffré (CONFIG_TOKEN_ENCRYPTION_KEY)</span
									>
								{:else}
									<span class="badge badge-ghost badge-sm"
										>en clair — optionnel : définir la clé ci-dessus</span
									>
								{/if}
							</p>
						</div>
					</div>

					<div class="divider">Google Sheets</div>

					<div class="form-control w-full">
						<label for="googleSpreadsheetId" class="label">
							<span class="label-text text-wrap">ID du Spreadsheet Google</span>
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

					{#if data.config?.canUseGoogleOAuth}
						<div class="mb-4 rounded-lg bg-base-200 p-4">
							<p class="mb-2 text-sm font-semibold text-wrap">
								URI de redirection à configurer dans Google Cloud Console :
							</p>
							<code class="rounded bg-base-300 px-2 py-1 text-xs break-all">
								{typeof window !== 'undefined'
									? `${window.location.origin}/api/google-oauth/callback`
									: 'Chargement...'}
							</code>
							<p class="mt-2 text-xs text-wrap text-base-content/70">
								⚠️ Cette URI doit être exactement la même dans Google Cloud Console → Identifiants
								OAuth 2.0 → URI de redirection autorisées
							</p>
						</div>

						<div class="form-control w-full">
							<a href="/api/google-oauth/authorize" class="btn btn-outline btn-primary">
								Autoriser avec Google
							</a>
							<div class="label">
								<span class="label-text-alt text-wrap text-base-content/50">
									{#if data.config?.hasGoogleOAuthToken}
										<span class="text-success">✓ Jetons OAuth présents (voir serveur / base)</span>
									{:else}
										Cliquez pour autoriser l'accès à Google Sheets
									{/if}
								</span>
							</div>
						</div>
					{:else}
						<div class="alert text-sm text-wrap alert-warning">
							<span>
								Le bouton OAuth n’apparaît que si <code class="text-xs">GOOGLE_OAUTH_CLIENT_ID</code
								>
								et
								<code class="text-xs">GOOGLE_OAUTH_CLIENT_SECRET</code> sont définis (variables d’environnement
								sur Vercel ou valeurs encore présentes en base). Redéploie après les avoir ajoutées.
							</span>
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
