import {
	getEffectiveConfig,
	getEffectiveConfigFromRow,
	toConfigClientSafe
} from '$lib/server/app-config';
import { runAutoCheckVersions } from '$lib/server/check-version';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { getValidAccessToken } from '$lib/server/google-oauth';
import { syncDbToSpreadsheetBulk } from '$lib/server/google-sheets-sync';
import { assertPermission } from '$lib/server/permissions';
import { eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

export const config = {
	maxDuration: 300,
	split: true
};

const syncAllDbToSpreadsheet = async (
	onProgress?: (message: string) => void,
	opts?: Parameters<typeof syncDbToSpreadsheetBulk>[1]
) => {
	return syncDbToSpreadsheetBulk(onProgress, opts ?? {});
};

export const load: PageServerLoad = async ({ locals }) => {
	await assertPermission(locals, 'dev.panel');

	let configRow;
	try {
		const configResult = await db
			.select()
			.from(table.config)
			.where(eq(table.config.id, 'main'))
			.limit(1);

		configRow = configResult[0] || null;
	} catch (error: unknown) {
		console.warn('Erreur lors du chargement de la configuration:', error);
		configRow = null;
	}

	const effective = configRow ? getEffectiveConfigFromRow(configRow) : await getEffectiveConfig();
	const config = configRow ? toConfigClientSafe(configRow) : null;
	const webhookStatus = {
		updates: Boolean(effective?.discordWebhookUpdates?.trim()),
		translators: Boolean(effective?.discordWebhookTranslators?.trim()),
		admin: Boolean(effective?.discordWebhookAdmin?.trim())
	};

	return {
		config,
		webhookStatus
	};
};

export const actions: Actions = {
	triggerAutoCheck: async ({ locals }) => {
		await assertPermission(locals, 'dev.panel');
		try {
			const result = await runAutoCheckVersions({
				refreshWebhookUrls: true,
				logSource: 'worker'
			});
			await db
				.update(table.config)
				.set({
					autoCheckLastRunAt: new Date(),
					updatedAt: new Date()
				})
				.where(eq(table.config.id, 'main'));

			return {
				success: true,
				message: `Auto-check : ${result.updatedGames} jeu(x) mis à jour, ${result.disabledAlignedGames} déjà aligné(s), ${result.translatorWebhooksSent} webhook(s) traducteur(s)`,
				details: result
			};
		} catch (error: unknown) {
			return {
				success: false,
				message: "Erreur lors de l'exécution de l'auto-check",
				details: error instanceof Error ? error.message : 'Erreur inconnue'
			};
		}
	},
	testGoogleSheets: async ({ request, locals }) => {
		await assertPermission(locals, 'dev.panel');
		const formData = await request.formData();
		const spreadsheetId = (formData.get('spreadsheetId') as string)?.trim();

		if (!spreadsheetId) {
			return {
				success: false,
				message: "L'ID du spreadsheet est requis",
				details: null
			};
		}

		try {
			const merged = await getEffectiveConfig();
			const apiKey = merged?.googleApiKey;

			const oauthToken = await getValidAccessToken();

			let apiUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=properties.title,sheets.properties.title`;

			const headers: HeadersInit = {
				Accept: 'application/json'
			};

			if (oauthToken) {
				headers['Authorization'] = `Bearer ${oauthToken}`;
			} else if (apiKey) {
				apiUrl += `&key=${encodeURIComponent(apiKey)}`;
			}

			const response = await fetch(apiUrl, {
				method: 'GET',
				headers
			});

			if (!response.ok) {
				let errorData;
				try {
					errorData = await response.json();
				} catch {
					errorData = { error: { message: `Erreur HTTP ${response.status}` } };
				}

				if (response.status === 404) {
					return {
						success: false,
						message: 'Spreadsheet introuvable',
						details: "L'ID du spreadsheet est incorrect ou le spreadsheet n'existe pas."
					};
				}

				if (response.status === 403) {
					if (!oauthToken && !apiKey) {
						return {
							success: false,
							message: 'Authentification requise',
							details:
								"Une clé API Google (GOOGLE_API_KEY) ou une authentification OAuth2 est nécessaire. Définissez les variables d'environnement côté serveur."
						};
					}
					return {
						success: false,
						message: 'Accès refusé',
						details: oauthToken
							? "Le spreadsheet n'est pas accessible avec ce compte OAuth2. Vérifiez que le compte a les permissions nécessaires."
							: "Le spreadsheet n'est pas accessible avec cette clé API. Vérifiez que la clé API est correcte et que le spreadsheet est partagé correctement."
					};
				}

				if (response.status === 401) {
					return {
						success: false,
						message: 'Clé API invalide',
						details:
							"La clé API (GOOGLE_API_KEY) est invalide ou a expiré. Vérifiez la variable d'environnement sur le serveur."
					};
				}

				return {
					success: false,
					message: `Erreur API: ${response.status}`,
					details: errorData.error?.message || "Erreur lors de la connexion à l'API Google Sheets"
				};
			}

			const data = await response.json();

			return {
				success: true,
				message: 'Connexion réussie !',
				details: {
					title: data.properties?.title || 'Sans titre',
					sheets:
						data.sheets?.map(
							(sheet: { properties: { title: string } }) => sheet.properties.title
						) || [],
					spreadsheetId
				}
			};
		} catch (error: unknown) {
			console.error('Erreur lors du test de connexion Google Sheets:', error);

			const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';

			return {
				success: false,
				message: 'Erreur lors de la connexion',
				details: errorMessage
			};
		}
	},
	testScrape: async ({ request, locals }) => {
		await assertPermission(locals, 'dev.panel');
		const formData = await request.formData();
		const threadIdRaw = formData.get('threadId');
		const website = (formData.get('website') as 'f95z' | 'lc' | 'other' | null) ?? null;

		const threadId = typeof threadIdRaw === 'string' ? Number.parseInt(threadIdRaw, 10) : null;

		if (!threadId || Number.isNaN(threadId)) {
			return {
				success: false,
				message: "L'ID du thread est requis",
				details: null
			};
		}

		if (!website || (website !== 'f95z' && website !== 'lc')) {
			return {
				success: false,
				message: 'Le scraping de test ne supporte que F95Zone et LewdCorner',
				details: null
			};
		}

		try {
			const { scrapeThread } = await import('$lib/server/scrape');
			const data = await scrapeThread(website, threadId);
			return {
				success: true,
				message: 'Scrape réussi',
				details: data
			};
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
			return {
				success: false,
				message: 'Erreur lors du scraping',
				details: errorMessage
			};
		}
	},
	syncDbToSpreadsheet: async ({ request, locals }) => {
		await assertPermission(locals, 'dev.panel');
		await request.formData();

		try {
			const result = await syncAllDbToSpreadsheet();

			return {
				success: result.errors.length === 0,
				message:
					result.errors.length === 0
						? 'Synchronisation DB -> Spreadsheet terminée'
						: 'Synchronisation terminée avec erreurs',
				details: result
			};
		} catch (error: unknown) {
			return {
				success: false,
				message: 'Erreur pendant la synchronisation globale',
				details: error instanceof Error ? error.message : 'Erreur inconnue'
			};
		}
	},
	testDiscordWebhook: async ({ request, locals }) => {
		await assertPermission(locals, 'dev.panel');
		const formData = await request.formData();
		const raw = formData.get('channel');
		const channel = raw === 'updates' || raw === 'translators' || raw === 'admin' ? raw : null;

		if (!channel) {
			return {
				success: false,
				message: 'Canal invalide',
				details: null,
				channel: null,
				httpStatus: null
			};
		}

		const cfg = await getEffectiveConfig();
		const urlByChannel = {
			updates: cfg?.discordWebhookUpdates,
			translators: cfg?.discordWebhookTranslators,
			admin: cfg?.discordWebhookAdmin
		} as const;

		const url = urlByChannel[channel]?.trim();
		if (!url) {
			return {
				success: false,
				message:
					"Aucune URL pour ce canal : définissez la variable d'environnement correspondante (voir /dashboard/config).",
				details: null,
				channel,
				httpStatus: null
			};
		}

		const labels: Record<typeof channel, string> = {
			updates: 'Mises à jour',
			translators: 'Traducteurs',
			admin: 'Admin'
		};

		const payload = {
			content: '',
			tts: false,
			embeds: [
				{
					title: 'Test webhook — F95 France',
					description: `Canal **${labels[channel]}** : la configuration est joignable depuis l'outil dev.`,
					color: 0x5865f2,
					footer: {
						text: `Dev · ${new Date().toISOString()}`
					}
				}
			]
		};

		try {
			const res = await fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
				signal: AbortSignal.timeout(15_000)
			});

			const bodyText = await res.text().catch(() => '');
			if (!res.ok) {
				return {
					success: false,
					message: `Discord a répondu ${res.status}`,
					details: bodyText ? bodyText.slice(0, 600) : 'Corps de réponse vide',
					channel,
					httpStatus: res.status
				};
			}

			return {
				success: true,
				message: `Message de test envoyé (${labels[channel]}).`,
				details: null,
				channel,
				httpStatus: res.status
			};
		} catch (error: unknown) {
			const msg = error instanceof Error ? error.message : 'Erreur inconnue';
			return {
				success: false,
				message: 'Échec de la requête vers Discord',
				details: msg,
				channel,
				httpStatus: null
			};
		}
	}
};
