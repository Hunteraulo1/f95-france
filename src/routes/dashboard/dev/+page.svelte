<script lang="ts">
	import { enhance } from '$app/forms';
	import { CircleCheck, CircleX, ExternalLink, Loader } from '@lucide/svelte';
	import type { PageData } from './$types';

	let { data, form }: { data: PageData; form?: any } = $props();
	
	// Type assertion pour config
	const config = (data as any).config;

	let isLoading = $state(false);
	let testResult = $state<{
		success: boolean;
		message: string;
		details: any;
	} | null>(null);
</script>

<div class="container mx-auto p-6 max-w-4xl">
	<h1 class="text-3xl font-bold text-base-content mb-6">Page de développement</h1>

	<!-- Test de connexion Google Sheets -->
	<div class="card bg-base-100 shadow-xl mb-6">
		<div class="card-body">
			<h2 class="card-title text-2xl mb-4">Test de connexion Google Sheets</h2>
			
			<p class="text-base-content/70 mb-4">
				Testez la connexion à votre Google Spreadsheet en utilisant son ID.
				L'ID se trouve dans l'URL du spreadsheet :
				<code class="bg-base-200 px-2 py-1 rounded">https://docs.google.com/spreadsheets/d/<span class="text-primary">SPREADSHEET_ID</span>/edit</code>
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
								details: any;
							};
						} else if (result.type === 'failure' && result.data) {
							// En cas d'erreur, result.data contient les données d'erreur
							const errorData = result.data as { message?: string; details?: any };
							testResult = {
								success: false,
								message: errorData.message || 'Erreur inconnue',
								details: errorData.details || null
							};
						}
					};
				}}
			>
				<div class="form-control w-full mb-4">
					<label for="spreadsheetId" class="label">
						<span class="label-text">ID du Spreadsheet</span>
					</label>
					<div class="flex gap-2">
						<input
							id="spreadsheetId"
							name="spreadsheetId"
							type="text"
							class="input input-bordered flex-1"
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
								<ExternalLink class="w-4 h-4" />
							</a>
						{/if}
					</div>
					<div class="label">
						<span class="label-text-alt text-base-content/50">
							{#if config?.googleSpreadsheetId}
								Utilise l'ID configuré dans les paramètres
							{:else}
								Ou configurez-le dans <a href="/dashboard/config" class="link link-primary">les paramètres</a>
							{/if}
						</span>
					</div>
				</div>

				<div class="form-control">
					<button 
						type="submit" 
						class="btn btn-primary"
						disabled={isLoading}
					>
						{#if isLoading}
							<Loader class="w-5 h-5 animate-spin" />
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
							<CircleCheck class="w-6 h-6" />
							<div class="flex-1">
								<h3 class="font-bold">{testResult.message}</h3>
								{#if typeof testResult.details === 'object' && testResult.details !== null}
									<div class="mt-2 space-y-1">
										<p><strong>Titre :</strong> {testResult.details.title}</p>
										<p><strong>ID :</strong> <code class="bg-base-200 px-2 py-1 rounded text-sm">{testResult.details.spreadsheetId}</code></p>
										{#if testResult.details.sheets && testResult.details.sheets.length > 0}
											<div>
												<strong>Feuilles :</strong>
												<ul class="list-disc list-inside ml-2">
													{#each testResult.details.sheets as sheet}
														<li>{sheet}</li>
													{/each}
												</ul>
											</div>
										{/if}
									</div>
								{:else}
									<p class="text-sm mt-1">{testResult.details}</p>
								{/if}
							</div>
						</div>
					{:else}
						<div class="alert alert-error">
							<CircleX class="w-6 h-6" />
							<div class="flex-1">
								<h3 class="font-bold">{testResult.message || 'Erreur inconnue'}</h3>
								{#if testResult.details}
									{#if typeof testResult.details === 'string'}
										<p class="text-sm mt-1">{testResult.details}</p>
									{:else}
										<pre class="whitespace-pre-wrap text-xs mt-1">{JSON.stringify(testResult.details, null, 2)}</pre>
									{/if}
								{:else if !testResult.message}
									<p class="text-sm mt-1">Aucun détail disponible</p>
								{/if}
							</div>
						</div>
					{/if}
				</div>
			{/if}

			<div class="divider">Informations</div>
			
			<div class="bg-base-200 rounded-lg p-4 space-y-2 text-sm">
				<p class="font-semibold">Note importante :</p>
				<ul class="list-disc list-inside space-y-1 text-base-content/70">
					<li><strong>OAuth2.0 (recommandé)</strong> : Permet d'accéder aux spreadsheets privés et publics. Configurez Client ID et Client Secret, puis autorisez l'accès.</li>
					<li><strong>Clé API</strong> : Alternative simple, mais limitée aux spreadsheets publics. Une clé API est requise même pour les spreadsheets publics.</li>
					<li>Pour créer les credentials : 
						<a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" class="link link-primary">
							Google Cloud Console
						</a>
					</li>
					<li>Activez l'API Google Sheets dans votre projet Google Cloud.</li>
					<li>Configurez les credentials dans <a href="/dashboard/config" class="link link-primary">les paramètres</a>.</li>
				</ul>
			</div>
		</div>
	</div>
</div>
