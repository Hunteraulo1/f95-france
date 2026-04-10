<script lang="ts">
	import { enhance } from '$app/forms';
	import type { Config } from '$lib/server/db/schema';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import CircleX from '@lucide/svelte/icons/circle-x';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import Loader from '@lucide/svelte/icons/loader';
	import Table2 from '@lucide/svelte/icons/table-2';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const config = $derived(data.config as Config | null | undefined);

	let isLoading = $state(false);
	type SheetsDetails = { title?: string; spreadsheetId?: string; sheets?: string[] };
	type ScrapeDetails = {
		name: string | null;
		version: string | null;
		status: string | null;
		tags: string | null;
		type: string | null;
		image: string | null;
	};
	type TestResult = { success: boolean; message: string; details: string | SheetsDetails | null };
	type ScrapeResult = { success: boolean; message: string; details: string | ScrapeDetails | null };
	type ImportResult = {
		success: boolean;
		message: string;
		details:
			| string
			| {
					total: number;
					insertedGames: number;
					updatedGames: number;
					insertedTranslations: number;
					updatedTranslations: number;
					createdTranslators: number;
					createdProofreaders: number;
					skipped: number;
			  }
			| null;
	};
	type CompareResult = {
		success: boolean;
		message: string;
		details:
			| string
			| {
					games: {
						total: number;
						insertedGames: number;
						updatedGames: number;
						insertedTranslations: number;
						updatedTranslations: number;
						createdTranslators: number;
						createdProofreaders: number;
						skipped: number;
					};
					translators: {
						total: number;
						inserted: number;
						updated: number;
						skipped: number;
					};
			  }
			| null;
	};
	type CleanupResult = {
		success: boolean;
		message: string;
		details: string | { before: number; after: number; removed: number } | null;
	};
	type TranslatorsImportResult = {
		success: boolean;
		message: string;
		details: string | { total: number; inserted: number; updated: number; skipped: number } | null;
	};
	type WebhookTestResult = {
		success: boolean;
		message: string;
		details: string | null;
		channel: string | null;
		httpStatus: number | null;
	};
	type DbSheetSyncResult = {
		success: boolean;
		message: string;
		details:
			| string
			| {
					totalTranslations: number;
					totalTranslators: number;
					syncedTranslations: number;
					syncedTranslators: number;
					errors: string[];
			  }
			| null;
	};
	type ClearTranslationNamesResult = {
		success: boolean;
		message: string;
		details: string | { updated: number } | null;
	};

	let testResult = $state<TestResult | null>(null);

	let scrapeIsLoading = $state(false);
	let scrapeResult = $state<ScrapeResult | null>(null);
	let importIsLoading = $state(false);
	let importResult = $state<ImportResult | null>(null);
	let compareIsLoading = $state(false);
	let compareResult = $state<CompareResult | null>(null);
	let syncIsLoading = $state(false);
	let syncResult = $state<ImportResult | null>(null);
	let cleanupIsLoading = $state(false);
	let cleanupResult = $state<CleanupResult | null>(null);
	let translatorsImportIsLoading = $state(false);
	let translatorsImportResult = $state<TranslatorsImportResult | null>(null);
	let webhookTestIsLoading = $state(false);
	let webhookTestResult = $state<WebhookTestResult | null>(null);
	let dbSheetSyncIsLoading = $state(false);
	let dbSheetSyncResult = $state<DbSheetSyncResult | null>(null);
	let clearTranslationNamesIsLoading = $state(false);
	let clearTranslationNamesResult = $state<ClearTranslationNamesResult | null>(null);

	const isSheetsDetails = (value: unknown): value is SheetsDetails =>
		typeof value === 'object' && value !== null;
	const isScrapeDetailsObject = (value: unknown): value is ScrapeDetails =>
		typeof value === 'object' && value !== null;
	const isImportDetailsObject = (value: unknown): value is ImportResult['details'] =>
		typeof value === 'string' || value === null || (typeof value === 'object' && value !== null);
	const isCompareDetailsObject = (value: unknown): value is CompareResult['details'] =>
		typeof value === 'string' || value === null || (typeof value === 'object' && value !== null);
	const isCleanupDetailsObject = (value: unknown): value is CleanupResult['details'] =>
		typeof value === 'string' || value === null || (typeof value === 'object' && value !== null);
	const isTranslatorsImportDetailsObject = (
		value: unknown
	): value is TranslatorsImportResult['details'] =>
		typeof value === 'string' || value === null || (typeof value === 'object' && value !== null);

	const webhookStatus = $derived(
		data.webhookStatus ?? {
			updates: false,
			translators: false,
			admin: false
		}
	);
	const webhookChannelLabels: Record<string, string> = {
		updates: 'Mises à jour',
		translators: 'Traducteurs',
		admin: 'Admin'
	};
	const webhookChannelLabel = (c: string) => webhookChannelLabels[c] ?? c;
</script>

<div class="container mx-auto max-w-4xl p-2 md:p-6">
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
					return async function ({ result, update }) {
						await update();
						isLoading = false;

						// Traiter le résultat de l'action
						if (result.type === 'success' && result.data) {
							const successData = result.data;
							const success =
								typeof successData === 'object' &&
								successData &&
								'success' in successData &&
								Boolean(successData.success);
							const message =
								typeof successData === 'object' &&
								successData &&
								'message' in successData &&
								typeof successData.message === 'string'
									? successData.message
									: '';
							const detailsRaw =
								typeof successData === 'object' &&
								successData &&
								'details' in successData &&
								(typeof successData.details === 'object' ||
									typeof successData.details === 'string' ||
									successData.details === null)
									? successData.details
									: null;
							const details =
								typeof detailsRaw === 'string' || detailsRaw === null || isSheetsDetails(detailsRaw)
									? detailsRaw
									: null;
							testResult = {
								success,
								message,
								details
							};
						} else if (result.type === 'failure' && result.data) {
							// En cas d'erreur, result.data contient les données d'erreur
							const errorData = result.data;
							const message =
								typeof errorData === 'object' &&
								errorData &&
								'message' in errorData &&
								typeof errorData.message === 'string'
									? errorData.message
									: 'Erreur inconnue';
							const detailsRaw =
								typeof errorData === 'object' &&
								errorData &&
								'details' in errorData &&
								(typeof errorData.details === 'object' ||
									typeof errorData.details === 'string' ||
									errorData.details === null)
									? errorData.details
									: null;
							const details =
								typeof detailsRaw === 'string' || detailsRaw === null || isSheetsDetails(detailsRaw)
									? detailsRaw
									: null;
							testResult = {
								success: false,
								message,
								details
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
						<span class="label-text-alt text-wrap text-base-content/50">
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
								{#if isSheetsDetails(testResult.details)}
									{@const details = testResult.details}
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

	<!-- Test webhooks Discord -->
	<div class="card mb-6 bg-base-100 shadow-xl">
		<div class="card-body">
			<h2 class="mb-4 card-title text-2xl">Test des webhooks Discord</h2>
			<p class="mb-4 text-base-content/70">
				Envoie un embed de test sur l’URL enregistrée dans
				<a href="/dashboard/config" class="link link-primary">les paramètres</a> pour vérifier que le
				salon reçoit bien les messages.
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

			{#if !webhookStatus.updates && !webhookStatus.translators && !webhookStatus.admin}
				<p class="mb-4 text-sm text-warning">
					Aucune URL de webhook enregistrée : ajoutez-en au moins une dans les paramètres pour
					tester.
				</p>
			{/if}

			<form
				method="POST"
				action="?/testDiscordWebhook"
				use:enhance={() => {
					webhookTestIsLoading = true;
					webhookTestResult = null;
					return async function ({ result, update }) {
						await update();
						webhookTestIsLoading = false;
						if (result.type === 'success' && result.data) {
							const d = result.data as Record<string, unknown>;
							const success = Boolean(d.success);
							const message = typeof d.message === 'string' ? d.message : '';
							const details =
								typeof d.details === 'string' || d.details === null ? d.details : null;
							const channel = typeof d.channel === 'string' ? d.channel : null;
							const httpStatus =
								typeof d.httpStatus === 'number' || d.httpStatus === null ? d.httpStatus : null;
							webhookTestResult = { success, message, details, channel, httpStatus };
						} else if (result.type === 'failure' && result.data) {
							const d = result.data as Record<string, unknown>;
							webhookTestResult = {
								success: false,
								message: typeof d.message === 'string' ? d.message : 'Erreur',
								details: typeof d.details === 'string' ? d.details : null,
								channel: typeof d.channel === 'string' ? d.channel : null,
								httpStatus:
									typeof d.httpStatus === 'number' || d.httpStatus === null ? d.httpStatus : null
							};
						}
					};
				}}
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
							disabled={webhookTestIsLoading ||
								(!webhookStatus.updates && !webhookStatus.translators && !webhookStatus.admin)}
						>
							{#if webhookStatus.updates}<option value="updates">Mises à jour</option>{/if}
							{#if webhookStatus.translators}<option value="translators">Traducteurs</option>{/if}
							{#if webhookStatus.admin}<option value="admin">Admin</option>{/if}
						</select>
					</div>
					<button
						type="submit"
						class="btn btn-primary"
						disabled={webhookTestIsLoading ||
							(!webhookStatus.updates && !webhookStatus.translators && !webhookStatus.admin)}
					>
						{#if webhookTestIsLoading}
							<Loader class="h-5 w-5 animate-spin" />
							<span>Envoi…</span>
						{:else}
							<span>Envoyer un message de test</span>
						{/if}
					</button>
				</div>
			</form>

			{#if webhookTestResult}
				<div class="mt-4">
					{#if webhookTestResult.success}
						<div class="alert alert-success">
							<CircleCheck class="h-6 w-6" />
							<div class="flex-1">
								<h3 class="font-bold">{webhookTestResult.message}</h3>
								{#if webhookTestResult.channel}
									<p class="mt-1 text-sm opacity-80">
										Canal : {webhookChannelLabel(webhookTestResult.channel)}
										{#if webhookTestResult.httpStatus != null}
											· HTTP {webhookTestResult.httpStatus}
										{/if}
									</p>
								{/if}
							</div>
						</div>
					{:else}
						<div class="alert alert-error">
							<CircleX class="h-6 w-6" />
							<div class="flex-1">
								<h3 class="font-bold">{webhookTestResult.message}</h3>
								{#if webhookTestResult.channel}
									<p class="mt-1 text-sm">
										Canal : {webhookChannelLabel(webhookTestResult.channel)}
										{#if webhookTestResult.httpStatus != null}
											· HTTP {webhookTestResult.httpStatus}
										{/if}
									</p>
								{/if}
								{#if webhookTestResult.details}
									<pre
										class="mt-2 max-h-40 overflow-auto text-xs whitespace-pre-wrap">{webhookTestResult.details}</pre>
								{/if}
							</div>
						</div>
					{/if}
				</div>
			{/if}
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
					return async function ({ result, update }) {
						await update();
						scrapeIsLoading = false;

						if (result.type === 'success' && result.data) {
							const successData = result.data;
							const success =
								typeof successData === 'object' &&
								successData &&
								'success' in successData &&
								Boolean(successData.success);
							const message =
								typeof successData === 'object' &&
								successData &&
								'message' in successData &&
								typeof successData.message === 'string'
									? successData.message
									: '';
							const detailsRaw =
								typeof successData === 'object' &&
								successData &&
								'details' in successData &&
								(typeof successData.details === 'object' ||
									typeof successData.details === 'string' ||
									successData.details === null)
									? successData.details
									: null;
							const details =
								typeof detailsRaw === 'string' ||
								detailsRaw === null ||
								isScrapeDetailsObject(detailsRaw)
									? detailsRaw
									: null;
							scrapeResult = {
								success,
								message,
								details
							};
						} else if (result.type === 'failure' && result.data) {
							const errorData = result.data;
							const message =
								typeof errorData === 'object' &&
								errorData &&
								'message' in errorData &&
								typeof errorData.message === 'string'
									? errorData.message
									: 'Erreur inconnue';
							const detailsRaw =
								typeof errorData === 'object' &&
								errorData &&
								'details' in errorData &&
								(typeof errorData.details === 'object' ||
									typeof errorData.details === 'string' ||
									errorData.details === null)
									? errorData.details
									: null;
							const details =
								typeof detailsRaw === 'string' ||
								detailsRaw === null ||
								isScrapeDetailsObject(detailsRaw)
									? detailsRaw
									: null;
							scrapeResult = {
								success: false,
								message,
								details
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
								{#if isScrapeDetailsObject(scrapeResult.details)}
									{@const details = scrapeResult.details}
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

	<!-- Import JSON legacy -->
	<div class="card mb-6 bg-base-100 shadow-xl">
		<div class="card-body">
			<h2 class="mb-4 card-title text-2xl">Import JSON ancien systeme</h2>
			<p class="mb-4 text-base-content/70">
				Colle ici un JSON de l'ancien systeme (tableau ou objet contenant <code>games</code>). Le
				script cree les jeux, traducteurs et traductions manquants.
			</p>
			<form
				method="POST"
				action="?/importLegacyGamesJson"
				use:enhance={() => {
					importIsLoading = true;
					importResult = null;
					return async function ({ result, update }) {
						await update();
						importIsLoading = false;
						if ((result.type === 'success' || result.type === 'failure') && result.data) {
							const data = result.data;
							importResult = {
								success:
									typeof data === 'object' && data && 'success' in data && Boolean(data.success),
								message:
									typeof data === 'object' &&
									data &&
									'message' in data &&
									typeof data.message === 'string'
										? data.message
										: '',
								details:
									typeof data === 'object' &&
									data &&
									'details' in data &&
									isImportDetailsObject(data.details)
										? data.details
										: null
							};
						}
					};
				}}
			>
				<div class="form-control">
					<label class="label" for="legacyJson">
						<span class="label-text">JSON</span>
					</label>
					<textarea
						id="legacyJson"
						name="legacyJson"
						class="textarea-bordered textarea h-48 w-full font-mono text-xs"
						placeholder="Collez ici votre JSON legacy"
						required
						disabled={importIsLoading}
					></textarea>
				</div>
				<div class="form-control mt-4">
					<button type="submit" class="btn btn-accent" disabled={importIsLoading}>
						{#if importIsLoading}
							<Loader class="h-5 w-5 animate-spin" />
							<span>Import en cours...</span>
						{:else}
							<span>Importer les jeux</span>
						{/if}
					</button>
				</div>
			</form>

			{#if importResult}
				<div class="mt-6">
					{#if importResult.success}
						<div class="alert alert-success">
							<CircleCheck class="h-6 w-6" />
							<div class="flex-1">
								<h3 class="font-bold">{importResult.message}</h3>
								{#if importResult.details && typeof importResult.details === 'object'}
									<p class="mt-1 text-sm">
										Total: {importResult.details.total} | Jeux ajoutes: {importResult.details
											.insertedGames} | Jeux mis a jour: {importResult.details.updatedGames} | Traductions
										ajoutees: {importResult.details.insertedTranslations} | Traductions mises a jour:
										{importResult.details.updatedTranslations} | Traducteurs crees: {importResult
											.details.createdTranslators} | Relecteurs crees: {importResult.details
											.createdProofreaders} | Ignores: {importResult.details.skipped}
									</p>
								{:else if typeof importResult.details === 'string'}
									<p class="mt-1 text-sm">{importResult.details}</p>
								{/if}
							</div>
						</div>
					{:else}
						<div class="alert alert-error">
							<CircleX class="h-6 w-6" />
							<div class="flex-1">
								<h3 class="font-bold">{importResult.message || 'Erreur inconnue'}</h3>
								{#if importResult.details}
									<p class="mt-1 text-sm">
										{typeof importResult.details === 'string'
											? importResult.details
											: JSON.stringify(importResult.details)}
									</p>
								{/if}
							</div>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>

	<div class="card mb-6 bg-base-100 shadow-xl">
		<div class="card-body">
			<h2 class="mb-4 card-title text-2xl">Synchronisation API legacy</h2>
			<p class="mb-4 text-base-content/70">
				Toutes les actions legacy sont regroupées ici (traducteurs + jeux/traductions).
			</p>
			<div class="grid gap-3 md:grid-cols-4">
				<form
					method="POST"
					action="?/syncLegacyApiTranslators"
					use:enhance={() => {
						translatorsImportIsLoading = true;
						translatorsImportResult = null;
						return async function ({ result, update }) {
							await update();
							translatorsImportIsLoading = false;
							if ((result.type === 'success' || result.type === 'failure') && result.data) {
								const data = result.data;
								translatorsImportResult = {
									success:
										typeof data === 'object' && data && 'success' in data && Boolean(data.success),
									message:
										typeof data === 'object' &&
										data &&
										'message' in data &&
										typeof data.message === 'string'
											? data.message
											: '',
									details:
										typeof data === 'object' &&
										data &&
										'details' in data &&
										isTranslatorsImportDetailsObject(data.details)
											? data.details
											: null
								};
							}
						};
					}}
					class="md:order-3"
				>
					<div class="form-control h-full">
						<button type="submit" class="btn btn-accent" disabled={translatorsImportIsLoading}>
							{#if translatorsImportIsLoading}
								<Loader class="h-5 w-5 animate-spin" />
								<span>Import en cours...</span>
							{:else}
								<span>Synchroniser les traducteurs</span>
							{/if}
						</button>
					</div>
				</form>
				<form
					method="POST"
					action="?/checkLegacyApiGames"
					use:enhance={() => {
						compareIsLoading = true;
						compareResult = null;
						return async function ({ result, update }) {
							await update();
							compareIsLoading = false;
							if ((result.type === 'success' || result.type === 'failure') && result.data) {
								const data = result.data;
								compareResult = {
									success:
										typeof data === 'object' && data && 'success' in data && Boolean(data.success),
									message:
										typeof data === 'object' &&
										data &&
										'message' in data &&
										typeof data.message === 'string'
											? data.message
											: '',
									details:
										typeof data === 'object' &&
										data &&
										'details' in data &&
										isCompareDetailsObject(data.details)
											? data.details
											: null
								};
							}
						};
					}}
					class="md:order-1"
				>
					<div class="form-control h-full">
						<button type="submit" class="btn btn-info" disabled={compareIsLoading}>
							{#if compareIsLoading}
								<Loader class="h-5 w-5 animate-spin" /><span>Comparaison...</span>
							{:else}
								<span>Vérification des données</span>
							{/if}
						</button>
					</div>
				</form>
				<form
					method="POST"
					action="?/syncLegacyApiGames"
					use:enhance={() => {
						syncIsLoading = true;
						syncResult = null;
						return async function ({ result, update }) {
							await update();
							syncIsLoading = false;
							if ((result.type === 'success' || result.type === 'failure') && result.data) {
								const data = result.data;
								syncResult = {
									success:
										typeof data === 'object' && data && 'success' in data && Boolean(data.success),
									message:
										typeof data === 'object' &&
										data &&
										'message' in data &&
										typeof data.message === 'string'
											? data.message
											: '',
									details:
										typeof data === 'object' &&
										data &&
										'details' in data &&
										isImportDetailsObject(data.details)
											? data.details
											: null
								};
							}
						};
					}}
					class="md:order-2"
				>
					<button type="submit" class="btn h-full w-full btn-accent" disabled={syncIsLoading}>
						{#if syncIsLoading}
							<Loader class="h-5 w-5 animate-spin" />
							<span>Ajout global en cours...</span>
						{:else}
							<span>Synchroniser les jeux/traductions</span>
						{/if}
					</button>
				</form>
				<form
					method="POST"
					action="?/syncDbToSpreadsheet"
					use:enhance={() => {
						dbSheetSyncIsLoading = true;
						dbSheetSyncResult = null;
						return async function ({ result, update }) {
							await update();
							dbSheetSyncIsLoading = false;
							if ((result.type === 'success' || result.type === 'failure') && result.data) {
								const data = result.data as Record<string, unknown>;
								dbSheetSyncResult = {
									success: Boolean(data.success),
									message: typeof data.message === 'string' ? data.message : '',
									details:
										typeof data.details === 'string' ||
										data.details === null ||
										(typeof data.details === 'object' && data.details !== null)
											? (data.details as DbSheetSyncResult['details'])
											: null
								};
							}
						};
					}}
					class="md:order-3"
				>
					<button
						type="submit"
						class="btn h-full w-full btn-secondary"
						disabled={dbSheetSyncIsLoading}
					>
						{#if dbSheetSyncIsLoading}
							<Loader class="h-5 w-5 animate-spin" />
							<span>Sync DB -> Spreadsheet...</span>
						{:else}
							<span>Synchroniser DB vers Spreadsheet</span>
						{/if}
					</button>
				</form>
				<form
					method="POST"
					action="?/cleanupDuplicateTranslations"
					use:enhance={() => {
						cleanupIsLoading = true;
						cleanupResult = null;
						return async function ({ result, update }) {
							await update();
							cleanupIsLoading = false;
							if ((result.type === 'success' || result.type === 'failure') && result.data) {
								const data = result.data;
								cleanupResult = {
									success:
										typeof data === 'object' && data && 'success' in data && Boolean(data.success),
									message:
										typeof data === 'object' &&
										data &&
										'message' in data &&
										typeof data.message === 'string'
											? data.message
											: '',
									details:
										typeof data === 'object' &&
										data &&
										'details' in data &&
										isCleanupDetailsObject(data.details)
											? data.details
											: null
								};
							}
						};
					}}
					class="md:order-4"
				>
					<button type="submit" class="btn h-full w-full btn-warning" disabled={cleanupIsLoading}>
						{#if cleanupIsLoading}
							<Loader class="h-5 w-5 animate-spin" />
							<span>Nettoyage...</span>
						{:else}
							<span>Nettoyer les doublons de traductions</span>
						{/if}
					</button>
				</form>
				<form
					method="POST"
					action="?/clearAllTranslationNames"
					use:enhance={() => {
						clearTranslationNamesIsLoading = true;
						clearTranslationNamesResult = null;
						return async function ({ result, update }) {
							await update();
							clearTranslationNamesIsLoading = false;
							if ((result.type === 'success' || result.type === 'failure') && result.data) {
								const data = result.data as Record<string, unknown>;
								clearTranslationNamesResult = {
									success: Boolean(data.success),
									message: typeof data.message === 'string' ? data.message : '',
									details:
										typeof data.details === 'string' ||
										data.details === null ||
										(typeof data.details === 'object' && data.details !== null)
											? (data.details as ClearTranslationNamesResult['details'])
											: null
								};
							}
						};
					}}
					class="md:order-5"
				>
					<button
						type="submit"
						class="btn h-full w-full btn-error"
						disabled={clearTranslationNamesIsLoading}
					>
						{#if clearTranslationNamesIsLoading}
							<Loader class="h-5 w-5 animate-spin" />
							<span>Suppression en cours...</span>
						{:else}
							<span>Vider tous les noms de traduction</span>
						{/if}
					</button>
				</form>
			</div>
			<div class="mt-6 space-y-3">
				{#if translatorsImportResult}
					{#if translatorsImportResult.success}
						<div class="alert alert-success">
							<CircleCheck class="h-6 w-6" />
							<div class="flex-1">
								<h3 class="font-bold">{translatorsImportResult.message}</h3>
								{#if translatorsImportResult.details && typeof translatorsImportResult.details === 'object'}
									<p class="mt-1 text-sm">
										Total: {translatorsImportResult.details.total} | Créés:
										{translatorsImportResult.details.inserted} | Mis à jour:
										{translatorsImportResult.details.updated} | Ignorés:
										{translatorsImportResult.details.skipped}
									</p>
								{:else if typeof translatorsImportResult.details === 'string'}
									<p class="mt-1 text-sm">{translatorsImportResult.details}</p>
								{/if}
							</div>
						</div>
					{:else}
						<div class="alert alert-error">
							<CircleX class="h-6 w-6" />
							<div class="flex-1">
								<h3 class="font-bold">{translatorsImportResult.message || 'Erreur inconnue'}</h3>
								{#if translatorsImportResult.details}
									<p class="mt-1 text-sm">
										{typeof translatorsImportResult.details === 'string'
											? translatorsImportResult.details
											: JSON.stringify(translatorsImportResult.details)}
									</p>
								{/if}
							</div>
						</div>
					{/if}
				{/if}
				{#if compareResult}
					{#if compareResult.success}
						<div class="alert alert-success">
							<CircleCheck class="h-6 w-6" />
							<div class="flex-1">
								<h3 class="font-bold">{compareResult.message}</h3>
								{#if compareResult.details && typeof compareResult.details === 'object'}
									<p class="mt-1 text-sm">
										<strong>Traducteurs:</strong>
										total {compareResult.details.translators.total}, créés {compareResult.details
											.translators.inserted}, mis à jour {compareResult.details.translators
											.updated}, ignorés {compareResult.details.translators.skipped}
									</p>
									<p class="mt-1 text-sm">
										<strong>Jeux/Traductions:</strong>
										total {compareResult.details.games.total}, jeux créés {compareResult.details
											.games.insertedGames}, jeux MAJ {compareResult.details.games.updatedGames},
										traductions créées {compareResult.details.games.insertedTranslations},
										traductions MAJ {compareResult.details.games.updatedTranslations}, traducteurs
										créés {compareResult.details.games.createdTranslators}, relecteurs créés {compareResult
											.details.games.createdProofreaders}, ignorés {compareResult.details.games
											.skipped}
									</p>
								{/if}
							</div>
						</div>
					{:else}
						<div class="alert alert-error">
							<CircleX class="h-6 w-6" />
							<div class="flex-1">
								<h3 class="font-bold">{compareResult.message || 'Erreur inconnue'}</h3>
								{#if compareResult.details}
									<p class="mt-1 text-sm">
										{typeof compareResult.details === 'string'
											? compareResult.details
											: JSON.stringify(compareResult.details)}
									</p>
								{/if}
							</div>
						</div>
					{/if}
				{/if}
				{#if syncResult}
					{#if syncResult.success}
						<div class="alert alert-success">
							<CircleCheck class="h-6 w-6" />
							<div class="flex-1">
								<h3 class="font-bold">{syncResult.message}</h3>
								{#if syncResult.details && typeof syncResult.details === 'object'}
									{@const legacyDetails = (
										'legacy' in syncResult.details &&
										typeof syncResult.details.legacy === 'object' &&
										syncResult.details.legacy !== null
											? syncResult.details.legacy
											: syncResult.details
									) as {
										total?: number;
										insertedGames?: number;
										updatedGames?: number;
										insertedTranslations?: number;
										updatedTranslations?: number;
									}}
									<p class="mt-1 text-sm">
										Total: {legacyDetails.total ?? 0} | Jeux ajoutes: {legacyDetails.insertedGames ??
											0} | Jeux mis a jour: {legacyDetails.updatedGames ?? 0} | Traductions ajoutees:
										{legacyDetails.insertedTranslations ?? 0} | Traductions mises a jour:
										{legacyDetails.updatedTranslations ?? 0}
									</p>
								{/if}
							</div>
						</div>
					{:else}
						<div class="alert alert-error">
							<CircleX class="h-6 w-6" />
							<div class="flex-1">
								<h3 class="font-bold">{syncResult.message || 'Erreur inconnue'}</h3>
								{#if syncResult.details}
									<p class="mt-1 text-sm">
										{typeof syncResult.details === 'string'
											? syncResult.details
											: JSON.stringify(syncResult.details)}
									</p>
								{/if}
							</div>
						</div>
					{/if}
				{/if}
				{#if dbSheetSyncResult}
					{#if dbSheetSyncResult.success}
						<div class="alert alert-success">
							<CircleCheck class="h-6 w-6" />
							<div class="flex-1">
								<h3 class="font-bold">{dbSheetSyncResult.message}</h3>
								{#if dbSheetSyncResult.details && typeof dbSheetSyncResult.details === 'object'}
									<p class="mt-1 text-sm">
										Traductions: {dbSheetSyncResult.details.syncedTranslations}/{dbSheetSyncResult
											.details.totalTranslations}
										| Traducteurs: {dbSheetSyncResult.details.syncedTranslators}/{dbSheetSyncResult
											.details.totalTranslators}
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
											Traductions: {dbSheetSyncResult.details.syncedTranslations}/{dbSheetSyncResult
												.details.totalTranslations}
											| Traducteurs: {dbSheetSyncResult.details
												.syncedTranslators}/{dbSheetSyncResult.details.totalTranslators}
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
			{#if cleanupResult}
				<div class="mt-3">
					{#if cleanupResult.success}
						<div class="alert alert-success">
							<CircleCheck class="h-6 w-6" />
							<div class="flex-1">
								<h3 class="font-bold">{cleanupResult.message}</h3>
								{#if cleanupResult.details && typeof cleanupResult.details === 'object'}
									<p class="mt-1 text-sm">
										Avant: {cleanupResult.details.before} | Après: {cleanupResult.details.after} | Supprimées:
										{cleanupResult.details.removed}
									</p>
								{/if}
							</div>
						</div>
					{:else}
						<div class="alert alert-error">
							<CircleX class="h-6 w-6" />
							<div class="flex-1">
								<h3 class="font-bold">{cleanupResult.message || 'Erreur inconnue'}</h3>
								{#if cleanupResult.details}
									<p class="mt-1 text-sm">
										{typeof cleanupResult.details === 'string'
											? cleanupResult.details
											: JSON.stringify(cleanupResult.details)}
									</p>
								{/if}
							</div>
						</div>
					{/if}
				</div>
			{/if}
			{#if clearTranslationNamesResult}
				<div class="mt-3">
					{#if clearTranslationNamesResult.success}
						<div class="alert alert-success">
							<CircleCheck class="h-6 w-6" />
							<div class="flex-1">
								<h3 class="font-bold">{clearTranslationNamesResult.message}</h3>
								{#if clearTranslationNamesResult.details && typeof clearTranslationNamesResult.details === 'object'}
									<p class="mt-1 text-sm">
										Lignes mises à jour: {clearTranslationNamesResult.details.updated}
									</p>
								{/if}
							</div>
						</div>
					{:else}
						<div class="alert alert-error">
							<CircleX class="h-6 w-6" />
							<div class="flex-1">
								<h3 class="font-bold">
									{clearTranslationNamesResult.message || 'Erreur inconnue'}
								</h3>
								{#if clearTranslationNamesResult.details}
									<p class="mt-1 text-sm">
										{typeof clearTranslationNamesResult.details === 'string'
											? clearTranslationNamesResult.details
											: JSON.stringify(clearTranslationNamesResult.details)}
									</p>
								{/if}
							</div>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>
</div>
