<script lang="ts">
	import { enhance } from '$app/forms';
	import { CircleCheck, CircleX, ExternalLink, Loader } from '@lucide/svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Type assertion pour config
	const config = (data as { config?: unknown }).config;

	let isLoading = $state(false);
	let testResult = $state<{
		success: boolean;
		message: string;
		details: unknown;
	} | null>(null);
</script>

<div class="container mx-auto max-w-4xl p-6">
	<h1 class="mb-6 text-3xl font-bold text-base-content">Page de développement</h1>

	<!-- Test de connexion Google Sheets -->
	<div class="card mb-6 bg-base-100 shadow-xl">
		<div class="card-body">
			<h2 class="mb-4 card-title text-2xl">Test de connexion Google Sheets</h2>

			<p class="mb-4 text-base-content/70">
				Testez la connexion à votre Google Spreadsheet en utilisant son ID. L'ID se trouve dans
				l'URL du spreadsheet :
				<code class="rounded bg-base-200 px-2 py-1"
					>https://docs.google.com/spreadsheets/d/<span class="text-primary">SPREADSHEET_ID</span
					>/edit</code
				>
			</p>

			<form
				method="POST"
				action="?/testGoogleSheets"
				use:enhance={() => {
					isLoading = true;
					testResult = null;
					return async ({ result, update }) => {
						await update();
						isLoading = false;

						// Traiter le résultat de l'action
						if (result.type === 'success' && result.data) {
							testResult = result.data as {
								success: boolean;
								message: string;
								details: unknown;
							};
						} else if (result.type === 'failure' && result.data) {
							// En cas d'erreur, result.data contient les données d'erreur
							const errorData = result.data as { message?: string; details?: unknown };
							testResult = {
								success: false,
								message: errorData.message || 'Erreur inconnue',
								details: errorData.details || null
							};
						}
					};
				}}
			>
				<div class="form-control mb-4 w-full">
					<label for="spreadsheetId" class="label">
						<span class="label-text">ID du Spreadsheet</span>
					</label>
					<div class="flex gap-2">
						<input
							id="spreadsheetId"
							name="spreadsheetId"
							type="text"
							class="input-bordered input flex-1"
							value={config?.googleSpreadsheetId || ''}
							placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
							required
							disabled={isLoading}
						/>
						{#if config?.googleSpreadsheetId}
							<a
								href="https://docs.google.com/spreadsheets/d/{config.googleSpreadsheetId}/edit"
								target="_blank"
								rel="noopener noreferrer"
								class="btn btn-outline"
								title="Ouvrir le spreadsheet"
							>
								<ExternalLink class="h-4 w-4" />
							</a>
						{/if}
					</div>
					<div class="label">
						<span class="label-text-alt text-base-content/50">
							{#if config?.googleSpreadsheetId}
								Utilise l'ID configuré dans les paramètres
							{:else}
								Ou configurez-le dans <a href="/dashboard/config" class="link link-primary"
									>les paramètres</a
								>
							{/if}
						</span>
					</div>
				</div>

				<div class="form-control">
					<button type="submit" class="btn btn-primary" disabled={isLoading}>
						{#if isLoading}
							<Loader class="h-5 w-5 animate-spin" />
							<span>Test en cours...</span>
						{:else}
							<span>Tester la connexion</span>
						{/if}
					</button>
				</div>
			</form>

			{#if testResult}
				<div class="mt-6">
					{#if testResult.success}
						<div class="alert alert-success">
							<CircleCheck class="h-6 w-6" />
							<div class="flex-1">
								<h3 class="font-bold">{testResult.message}</h3>
								{#if typeof testResult.details === 'object' && testResult.details !== null}
									<div class="mt-2 space-y-1">
										<p><strong>Titre :</strong> {testResult.details.title}</p>
										<p>
											<strong>ID :</strong>
											<code class="rounded bg-base-200 px-2 py-1 text-sm"
												>{testResult.details.spreadsheetId}</code
											>
										</p>
										{#if testResult.details.sheets && testResult.details.sheets.length > 0}
											<div>
												<strong>Feuilles :</strong>
												<ul class="ml-2 list-inside list-disc">
													{#each (testResult.details as { sheets?: string[] }).sheets || [] as sheet (sheet)}
														<li>{sheet}</li>
													{/each}
												</ul>
											</div>
										{/if}
									</div>
								{:else}
									<p class="mt-1 text-sm">{testResult.details}</p>
								{/if}
							</div>
						</div>
					{:else}
						<div class="alert alert-error">
							<CircleX class="h-6 w-6" />
							<div class="flex-1">
								<h3 class="font-bold">{testResult.message || 'Erreur inconnue'}</h3>
								{#if testResult.details}
									{#if typeof testResult.details === 'string'}
										<p class="mt-1 text-sm">{testResult.details}</p>
									{:else}
										<pre class="mt-1 text-xs whitespace-pre-wrap">{JSON.stringify(
												testResult.details,
												null,
												2
											)}</pre>
									{/if}
								{:else if !testResult.message}
									<p class="mt-1 text-sm">Aucun détail disponible</p>
								{/if}
							</div>
						</div>
					{/if}
				</div>
			{/if}

			<div class="divider">Informations</div>

			<div class="space-y-2 rounded-lg bg-base-200 p-4 text-sm">
				<p class="font-semibold">Note importante :</p>
				<ul class="list-inside list-disc space-y-1 text-base-content/70">
					<li>
						<strong>OAuth2.0 (recommandé)</strong> : Permet d'accéder aux spreadsheets privés et publics.
						Configurez Client ID et Client Secret, puis autorisez l'accès.
					</li>
					<li>
						<strong>Clé API</strong> : Alternative simple, mais limitée aux spreadsheets publics. Une
						clé API est requise même pour les spreadsheets publics.
					</li>
					<li>
						Pour créer les credentials :
						<a
							href="https://console.cloud.google.com/apis/credentials"
							target="_blank"
							rel="noopener noreferrer"
							class="link link-primary"
						>
							Google Cloud Console
						</a>
					</li>
					<li>Activez l'API Google Sheets dans votre projet Google Cloud.</li>
					<li>
						Configurez les credentials dans <a href="/dashboard/config" class="link link-primary"
							>les paramètres</a
						>.
					</li>
				</ul>
			</div>
		</div>
	</div>
</div>
