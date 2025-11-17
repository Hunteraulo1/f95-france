import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { getValidAccessToken } from '$lib/server/google-oauth';
import { scrapeF95Thread } from '$lib/server/scrape/f95';
import { eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	// Vérifier que l'utilisateur est admin
	if (!locals.user || (locals.user.role !== 'admin' && locals.user.role !== 'superadmin')) {
		throw new Error('Accès non autorisé');
	}

	// Charger la configuration
	let config;
	try {
		const configResult = await db
			.select()
			.from(table.config)
			.where(eq(table.config.id, 'main'))
			.limit(1);

		config = configResult[0] || null;
	} catch (error: unknown) {
		console.warn('Erreur lors du chargement de la configuration:', error);
		config = null;
	}

	return {
		config
	};
};

export const actions: Actions = {
	testGoogleSheets: async ({ request, locals }) => {
		// Vérifier que l'utilisateur est admin
		if (!locals.user || (locals.user.role !== 'admin' && locals.user.role !== 'superadmin')) {
			return {
				success: false,
				message: 'Accès non autorisé',
				details: null
			};
		}

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
			// Charger la configuration pour obtenir la clé API ou le token OAuth2
			const configResult = await db
				.select()
				.from(table.config)
				.where(eq(table.config.id, 'main'))
				.limit(1);

			const config = configResult[0];
			const apiKey = config?.googleApiKey;

			// Essayer d'obtenir un token OAuth2 valide
			const oauthToken = await getValidAccessToken();

			// Tester la connexion avec l'API Google Sheets
			// On utilise l'API REST directement pour tester l'accès
			let apiUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=properties.title,sheets.properties.title`;

			const headers: HeadersInit = {
				Accept: 'application/json'
			};

			// Utiliser OAuth2 si disponible, sinon utiliser la clé API
			if (oauthToken) {
				headers['Authorization'] = `Bearer ${oauthToken}`;
			} else if (apiKey) {
				apiUrl += `&key=${encodeURIComponent(apiKey)}`;
			}

			const response = await fetch(apiUrl, {
				method: 'GET',
				headers
			});

			// Si la réponse n'est pas OK, essayer de parser l'erreur
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
								"Une clé API Google ou une authentification OAuth2 est nécessaire pour accéder aux spreadsheets via l'API. Veuillez configurer l'une des deux méthodes dans les paramètres."
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
							'La clé API configurée est invalide ou a expiré. Veuillez vérifier votre clé API dans les paramètres.'
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
		if (!locals.user || (locals.user.role !== 'admin' && locals.user.role !== 'superadmin')) {
			return {
				success: false,
				message: 'Accès non autorisé',
				details: null
			};
		}

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

		if (!website || website !== 'f95z') {
			return {
				success: false,
				message: 'Le scraping de test ne supporte actuellement que les threads F95',
				details: null
			};
		}

		try {
			const data = await scrapeF95Thread(threadId);
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
	}
};
