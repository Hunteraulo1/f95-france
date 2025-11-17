<script lang="ts">
	import { enhance } from '$app/forms';
	import type { Config } from '$lib/server/db/schema';
	import { CircleCheck, CircleX, ExternalLink, Loader, Table2 } from '@lucide/svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Type assertion pour config
	const config = data.config as Config | null | undefined;

	let isLoading = $state(false);
	let testResult = $state<{
		success: boolean;
		message: string;
		details:
			| {
					title?: string;
					spreadsheetId?: string;
					sheets?: string[];
			  }
			| string
			| null;
	} | null>(null);

	let scrapeIsLoading = $state(false);
	let scrapeResult = $state<{
		success: boolean;
		message: string;
		details:
			| {
					name: string | null;
					version: string | null;
					status: string | null;
					tags: string | null;
					type: string | null;
					image: string | null;
			  }
			| string
			| null;
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
							const successData = result.data as {
								success: boolean;
								message: string;
								details?:
									| string
									| { title?: string; spreadsheetId?: string; sheets?: string[] }
									| null;
							};
							testResult = {
								success: successData.success,
								message: successData.message,
								details: successData.details || null
							};
						} else if (result.type === 'failure' && result.data) {
							// En cas d'erreur, result.data contient les données d'erreur
							const errorData = result.data as {
								message?: string;
								details?:
									| string
									| { title?: string; spreadsheetId?: string; sheets?: string[] }
									| null;
							};
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
								{#if typeof testResult.details === 'object' && testResult.details !== null && !(typeof testResult.details === 'string')}
									{@const details = testResult.details as {
										title?: string;
										spreadsheetId?: string;
										sheets?: string[];
									}}
									<div class="mt-2 space-y-1">
										{#if details.title}
											<p><strong>Titre :</strong> {details.title}</p>
										{/if}
										{#if details.spreadsheetId}
											<p>
												<strong>ID :</strong>
												<code class="rounded bg-base-200 px-2 py-1 text-sm"
													>{details.spreadsheetId}</code
												>
											</p>
										{/if}
										{#if details.sheets && details.sheets.length > 0}
											<div>
												<strong>Feuilles :</strong>
												<ul class="ml-2 list-inside list-disc">
													{#each details.sheets as sheet (sheet)}
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

	<!-- Test de scraping F95 -->
	<div class="card mb-6 bg-base-100 shadow-xl">
		<div class="card-body">
			<h2 class="mb-4 card-title text-2xl">Test de récupération F95</h2>

			<p class="mb-4 text-base-content/70">
				Scrape un thread F95 pour vérifier les données récupérées automatiquement (nom, version,
				tags, image, etc.). Seuls les threads F95 sont supportés pour le moment.
			</p>

			<form
				method="POST"
				action="?/testScrape"
				use:enhance={() => {
					scrapeIsLoading = true;
					scrapeResult = null;
					return async ({ result, update }) => {
						await update();
						scrapeIsLoading = false;

						if (result.type === 'success' && result.data) {
							const successData = result.data as {
								success: boolean;
								message: string;
								details?:
									| string
									| {
											name: string | null;
											version: string | null;
											status: string | null;
											tags: string | null;
											type: string | null;
											image: string | null;
									  }
									| null;
							};
							scrapeResult = {
								success: successData.success,
								message: successData.message,
								details: successData.details || null
							};
						} else if (result.type === 'failure' && result.data) {
							const errorData = result.data as {
								message?: string;
								details?:
									| string
									| {
											name: string | null;
											version: string | null;
											status: string | null;
											tags: string | null;
											type: string | null;
											image: string | null;
									  }
									| null;
							};
							scrapeResult = {
								success: false,
								message: errorData.message || 'Erreur inconnue',
								details: errorData.details || null
							};
						}
					};
				}}
			>
				<div class="grid gap-4 md:grid-cols-3">
					<div class="form-control md:col-span-2">
						<label for="threadId" class="label">
							<span class="label-text">ID du thread F95</span>
						</label>
						<input
							id="threadId"
							name="threadId"
							type="number"
							min="1"
							class="input-bordered input w-full"
							placeholder="Ex: 26002"
							required
							disabled={scrapeIsLoading}
						/>
					</div>
					<div class="form-control">
						<label for="website" class="label">
							<span class="label-text">Plateforme</span>
						</label>
						<select
							id="website"
							name="website"
							class="select-bordered select w-full"
							required
							disabled={scrapeIsLoading}
						>
							<option value="f95z" selected>F95Zone</option>
							<option value="lc" disabled>LewdCorner (bientôt)</option>
						</select>
					</div>
				</div>
				<div class="form-control mt-4">
					<button type="submit" class="btn btn-secondary" disabled={scrapeIsLoading}>
						{#if scrapeIsLoading}
							<Loader class="h-5 w-5 animate-spin" />
							<span>Scrape en cours...</span>
						{:else}
							<Table2 class="h-4 w-4" />
							<span>Lancer le scrape</span>
						{/if}
					</button>
				</div>
			</form>

			{#if scrapeResult}
				<div class="mt-6">
					{#if scrapeResult.success}
						<div class="alert alert-success">
							<CircleCheck class="h-6 w-6" />
							<div class="flex-1">
								<h3 class="font-bold">{scrapeResult.message}</h3>
								{#if typeof scrapeResult.details === 'object' && scrapeResult.details !== null && !(typeof scrapeResult.details === 'string')}
									{@const details = scrapeResult.details as {
										name: string | null;
										version: string | null;
										status: string | null;
										tags: string | null;
										type: string | null;
										image: string | null;
									}}
									<div class="mt-2 grid gap-4 md:grid-cols-2">
										<div class="space-y-1 text-sm">
											{#if details.name}
												<p><strong>Nom :</strong> {details.name}</p>
											{/if}
											{#if details.version}
												<p><strong>Version :</strong> {details.version}</p>
											{/if}
											{#if details.status}
												<p><strong>Statut :</strong> {details.status}</p>
											{/if}
											{#if details.type}
												<p><strong>Moteur :</strong> {details.type}</p>
											{/if}
											{#if details.tags}
												<p class="whitespace-pre-wrap">
													<strong>Tags :</strong>
													{details.tags}
												</p>
											{/if}
										</div>
										{#if details.image}
											<div class="flex justify-center">
												<img
													src={details.image}
													alt="Aperçu"
													class="h-40 w-28 rounded-lg object-cover shadow"
													loading="lazy"
												/>
											</div>
										{/if}
									</div>
								{:else if scrapeResult.details}
									<p class="mt-1 text-sm">{scrapeResult.details}</p>
								{/if}
							</div>
						</div>
					{:else}
						<div class="alert alert-error">
							<CircleX class="h-6 w-6" />
							<div class="flex-1">
								<h3 class="font-bold">{scrapeResult.message || 'Erreur inconnue'}</h3>
								{#if scrapeResult.details}
									{#if typeof scrapeResult.details === 'string'}
										<p class="mt-1 text-sm">{scrapeResult.details}</p>
									{:else}
										<pre class="mt-1 text-xs whitespace-pre-wrap">{JSON.stringify(
												scrapeResult.details,
												null,
												2
											)}</pre>
									{/if}
								{:else if !scrapeResult.message}
									<p class="mt-1 text-sm">Aucun détail disponible</p>
								{/if}
							</div>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>
</div>
