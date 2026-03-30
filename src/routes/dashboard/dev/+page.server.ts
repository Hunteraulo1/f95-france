import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { getValidAccessToken } from '$lib/server/google-oauth';
import {
	syncTranslationToGoogleSheet,
	syncTranslatorToGoogleSheet
} from '$lib/server/google-sheets-sync';
import { scrapeF95Thread } from '$lib/server/scrape/f95';
import { eq, inArray, sql } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

const LEGACY_API_URL =
	env.LEGACY_API_URL ||
	'https://script.google.com/macros/s/AKfycbybvrFy6B2L7rkLWJnrwRHhP0F6Sv0uk6V9zUTZibwEzUjKXf-abOK_N6jUhqFPs9US/exec';

type LegacyGame = {
	id?: number | string;
	domain?: string | null;
	name?: string | null;
	version?: string | null;
	tversion?: string | null;
	tname?: string | null;
	status?: string | null;
	tags?: string[] | string | null;
	type?: string | null;
	traductor?: string | null;
	proofreader?: string | null;
	ttype?: string | null;
	ac?: boolean | null;
	image?: string | null;
	link?: string | null;
	tlink?: string | null;
};

type LegacyTranslatorPage = { title?: string | null; name?: string | null; link?: string | null };

type LegacyTranslator = {
	id?: string | number | null;
	name?: string | number | null;
	discordId?: string | number | null;
	pages?: string[] | string | LegacyTranslatorPage[] | null;
	tradCount?: number | string | null;
	readCount?: number | string | null;
};

const mapType = (value: string | null | undefined): string => {
	const normalized = (value ?? '').toLowerCase();
	if (normalized.includes('renpy')) return 'renpy';
	if (normalized.includes('rpg')) return 'rpgm';
	if (normalized.includes('unity')) return 'unity';
	if (normalized.includes('unreal')) return 'unreal';
	if (normalized.includes('flash')) return 'flash';
	if (normalized.includes('html')) return 'html';
	if (normalized.includes('qsp')) return 'qsp';
	return 'other';
};

const mapStatus = (value: string | null | undefined): string => {
	const normalized = (value ?? '').toLowerCase();
	if (normalized.includes('aband')) return 'abandoned';
	if (normalized.includes('termin') || normalized.includes('complete')) return 'completed';
	return 'in_progress';
};

const mapTName = (value: string | null | undefined): string => {
	const normalized = (value ?? '').toLowerCase();
	if (normalized.includes('integr')) return 'integrated';
	if (normalized.includes('mod')) return 'translation_with_mods';
	if (normalized.includes('trad')) return 'translation';
	return 'no_translation';
};

const mapTType = (value: string | null | undefined): string => {
	const normalized = (value ?? '').toLowerCase();
	if (normalized.includes('semi')) return 'semi-auto';
	if (normalized.includes('manuel') || normalized.includes('manual')) return 'manual';
	if (normalized.includes('vf')) return 'vf';
	if (normalized.includes('test')) return 'to_tested';
	if (normalized.includes('hs')) return 'hs';
	return 'auto';
};

const mapWebsite = (value: string | null | undefined): 'f95z' | 'lc' | 'other' => {
	const normalized = (value ?? '').toLowerCase();
	if (normalized.includes('f95')) return 'f95z';
	if (normalized.includes('lewd') || normalized === 'lc') return 'lc';
	return 'other';
};

const parseLegacyGames = (input: unknown): LegacyGame[] | null => {
	if (Array.isArray(input)) return input as LegacyGame[];
	if (
		typeof input === 'object' &&
		input !== null &&
		'games' in input &&
		Array.isArray((input as { games?: unknown }).games)
	) {
		return (input as { games: LegacyGame[] }).games;
	}
	return null;
};

const parseLegacyTranslators = (input: unknown): LegacyTranslator[] | null => {
	if (
		typeof input === 'object' &&
		input !== null &&
		'data' in input &&
		typeof (input as { data?: unknown }).data === 'object' &&
		(input as { data?: unknown }).data !== null &&
		'traductors' in ((input as { data: { traductors?: unknown } }).data ?? {}) &&
		Array.isArray((input as { data: { traductors?: unknown[] } }).data.traductors)
	) {
		return (input as { data: { traductors: LegacyTranslator[] } }).data.traductors;
	}
	return null;
};

const safeNumber = (value: unknown): number | null => {
	if (typeof value === 'number' && Number.isFinite(value)) return value;
	if (typeof value === 'string') {
		const parsed = Number.parseInt(value, 10);
		return Number.isFinite(parsed) ? parsed : null;
	}
	return null;
};

/** Same shape as le tableau édité dans /dashboard/translators : { name, link }[] */
const parsePages = (value: unknown): string => {
	const normalizeEntry = (entry: unknown): { name: string; link: string } | null => {
		if (typeof entry === 'string') {
			const link = entry.trim();
			if (!link) return null;
			return { name: '', link };
		}
		if (entry && typeof entry === 'object') {
			const o = entry as Record<string, unknown>;
			const linkRaw =
				(typeof o.link === 'string' && o.link.trim()) ||
				(typeof o.url === 'string' && o.url.trim()) ||
				(typeof o.href === 'string' && o.href.trim()) ||
				'';
			const nameRaw =
				(typeof o.name === 'string' && o.name.trim()) ||
				(typeof o.title === 'string' && o.title.trim()) ||
				(typeof o.label === 'string' && o.label.trim()) ||
				'';
			if (!linkRaw && !nameRaw) return null;
			return { name: nameRaw, link: linkRaw };
		}
		return null;
	};

	if (Array.isArray(value)) {
		const out = value
			.map(normalizeEntry)
			.filter((x): x is { name: string; link: string } => x !== null);
		return JSON.stringify(out);
	}
	if (typeof value === 'string') {
		const trimmed = value.trim();
		if (!trimmed) return '[]';
		try {
			const parsed: unknown = JSON.parse(trimmed);
			if (Array.isArray(parsed)) {
				const out = parsed
					.map(normalizeEntry)
					.filter((x): x is { name: string; link: string } => x !== null);
				return JSON.stringify(out);
			}
		} catch {
			return JSON.stringify(
				trimmed
					.split(',')
					.map((v) => v.trim())
					.filter((v) => v.length > 0)
					.map((link) => ({ name: '', link }))
			);
		}
	}
	return '[]';
};

const upsertLegacyTranslators = async (
	translators: LegacyTranslator[],
	options: { dryRun?: boolean } = {}
) => {
	const dryRun = options.dryRun === true;
	let inserted = 0;
	let updated = 0;
	let skipped = 0;

	const existing = await db
		.select({
			id: table.translator.id,
			name: table.translator.name,
			discordId: table.translator.discordId,
			pages: table.translator.pages,
			tradCount: table.translator.tradCount,
			readCount: table.translator.readCount
		})
		.from(table.translator);

	const byName = new Map<string, (typeof existing)[number]>();
	const byDiscordId = new Map<string, (typeof existing)[number]>();

	for (const row of existing) {
		byName.set(row.name.toLowerCase(), row);
		if (row.discordId) byDiscordId.set(row.discordId, row);
	}

	for (const item of translators) {
		const name =
			typeof item.name === 'string'
				? item.name.trim()
				: typeof item.name === 'number'
					? String(item.name).trim()
					: '';
		if (!name) {
			skipped++;
			continue;
		}

		const discordId =
			typeof item.discordId === 'string'
				? item.discordId.trim() || null
				: typeof item.discordId === 'number'
					? String(item.discordId)
					: null;
		const pages = parsePages(item.pages);
		const tradCount = safeNumber(item.tradCount) ?? 0;
		const readCount = safeNumber(item.readCount) ?? 0;

		let current =
			(discordId ? byDiscordId.get(discordId) : undefined) ??
			byName.get(name.toLowerCase()) ??
			null;

		if (!current) {
			const id = crypto.randomUUID();
			if (!dryRun) {
				await db.insert(table.translator).values({
					id,
					name,
					discordId,
					pages,
					tradCount,
					readCount
				});
			}
			const created = { id, name, discordId, pages, tradCount, readCount };
			byName.set(name.toLowerCase(), created);
			if (discordId) byDiscordId.set(discordId, created);
			inserted++;
			continue;
		}

		const shouldUpdate =
			current.name !== name ||
			(current.discordId ?? null) !== discordId ||
			current.pages !== pages ||
			current.tradCount !== tradCount ||
			current.readCount !== readCount;

		if (!shouldUpdate) continue;

		if (!dryRun) {
			await db
				.update(table.translator)
				.set({
					name,
					discordId,
					pages,
					tradCount,
					readCount
				})
				.where(eq(table.translator.id, current.id));
		}

		current = { ...current, name, discordId, pages, tradCount, readCount };
		byName.set(name.toLowerCase(), current);
		if (discordId) byDiscordId.set(discordId, current);
		updated++;
	}

	return {
		total: translators.length,
		inserted,
		updated,
		skipped
	};
};

const normalizeKeyPart = (value: string | null | undefined): string =>
	(value ?? '')
		.normalize('NFD')
		.replace(/\p{Diacritic}/gu, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, ' ')
		.trim()
		.replace(/\s+/g, ' ');

const translationKeyFrom = (
	name: string | null | undefined,
	tversionKey: string | null | undefined
): string => `${normalizeKeyPart(name)}:${normalizeKeyPart(tversionKey)}`;

const upsertLegacyGames = async (games: LegacyGame[], options: { dryRun?: boolean } = {}) => {
	const dryRun = options.dryRun === true;
	let insertedGames = 0;
	let updatedGames = 0;
	let insertedTranslations = 0;
	let updatedTranslations = 0;
	let createdTranslators = 0;
	let createdProofreaders = 0;
	let skipped = 0;

	const existingGames = await db
		.select({
			id: table.game.id,
			threadId: table.game.threadId,
			website: table.game.website,
			link: table.game.link,
			name: table.game.name,
			type: table.game.type,
			tags: table.game.tags,
			image: table.game.image,
			gameVersion: table.game.gameVersion
		})
		.from(table.game);
	const gamesByThread = new Map<string, string>();
	const gamesByLink = new Map<string, string>();
	const gamesSnapshot = new Map<string, (typeof existingGames)[number]>();
	for (const game of existingGames) {
		gamesSnapshot.set(game.id, game);
		if (game.threadId !== null && game.threadId !== undefined) {
			gamesByThread.set(`${game.website}:${game.threadId}`, game.id);
		}
		if (game.link) gamesByLink.set(game.link, game.id);
	}

	const existingTranslators = await db
		.select({ id: table.translator.id, name: table.translator.name })
		.from(table.translator);
	const translatorByName = new Map<string, string>();
	for (const row of existingTranslators) {
		translatorByName.set(row.name.toLowerCase(), row.id);
	}

	const existingTranslations = await db
		.select({
			id: table.gameTranslation.id,
			tversion: table.gameTranslation.tversion,
			gameName: table.game.name
		})
		.from(table.gameTranslation)
		.innerJoin(table.game, eq(table.game.id, table.gameTranslation.gameId));
	const translationByKey = new Map<string, string>();
	for (const row of existingTranslations) {
		translationByKey.set(translationKeyFrom(row.gameName, row.tversion), row.id);
	}

	for (const item of games) {
		const threadId =
			typeof item.id === 'number'
				? item.id
				: typeof item.id === 'string'
					? Number.parseInt(item.id, 10)
					: null;
		const name = item.name?.trim();
		const link = item.link?.trim() ?? '';
		const website = mapWebsite(item.domain);

		if (!name) {
			skipped++;
			continue;
		}

		let gameId: string | undefined;
		if (threadId && Number.isFinite(threadId)) gameId = gamesByThread.get(`${website}:${threadId}`);
		if (!gameId && link) gameId = gamesByLink.get(link);

		const tags = Array.isArray(item.tags)
			? item.tags.join(', ')
			: typeof item.tags === 'string'
				? item.tags
				: '';
		const gameVersion =
			typeof item.version === 'string' && item.version.trim() ? item.version.trim() : null;

		if (gameId) {
			const prev = gamesSnapshot.get(gameId);
			const nextValues = {
				name,
				type: mapType(item.type),
				tags,
				image: item.image?.trim() || '',
				website,
				threadId: threadId && Number.isFinite(threadId) ? threadId : null,
				link,
				gameVersion
			};
			if (
				!prev ||
				prev.name !== nextValues.name ||
				prev.type !== nextValues.type ||
				prev.tags !== nextValues.tags ||
				prev.image !== nextValues.image ||
				prev.website !== nextValues.website ||
				prev.threadId !== nextValues.threadId ||
				prev.link !== nextValues.link ||
				(prev.gameVersion ?? null) !== (nextValues.gameVersion ?? null)
			) {
				if (!dryRun) {
					await db.update(table.game).set(nextValues).where(eq(table.game.id, gameId));
				}
				gamesSnapshot.set(gameId, { ...(prev ?? { id: gameId }), ...nextValues });
				updatedGames++;
			}
		} else {
			gameId = crypto.randomUUID();
			const row = {
				id: gameId,
				name,
				type: mapType(item.type),
				tags,
				image: item.image?.trim() || '',
				website,
				threadId: threadId && Number.isFinite(threadId) ? threadId : null,
				link,
				gameAutoCheck: website === 'f95z',
				gameVersion
			};
			if (!dryRun) {
				await db.insert(table.game).values(row);
			}
			gamesSnapshot.set(gameId, row);
			if (row.threadId !== null) gamesByThread.set(`${row.website}:${row.threadId}`, gameId);
			if (row.link) gamesByLink.set(row.link, gameId);
			insertedGames++;
		}

		const translatorName = item.traductor?.trim();
		let translatorId: string | null = null;
		if (translatorName) {
			translatorId = translatorByName.get(translatorName.toLowerCase()) ?? null;
			if (!translatorId) {
				translatorId = dryRun ? `dry-tr-${translatorName.toLowerCase()}` : crypto.randomUUID();
				if (!dryRun) {
					await db
						.insert(table.translator)
						.values({ id: translatorId, name: translatorName, pages: '[]' });
				}
				translatorByName.set(translatorName.toLowerCase(), translatorId);
				createdTranslators++;
			}
		}

		const proofreaderName = item.proofreader?.trim();
		let proofreaderId: string | null = null;
		if (proofreaderName) {
			proofreaderId = translatorByName.get(proofreaderName.toLowerCase()) ?? null;
			if (!proofreaderId) {
				proofreaderId = dryRun ? `dry-pr-${proofreaderName.toLowerCase()}` : crypto.randomUUID();
				if (!dryRun) {
					await db
						.insert(table.translator)
						.values({ id: proofreaderId, name: proofreaderName, pages: '[]' });
				}
				translatorByName.set(proofreaderName.toLowerCase(), proofreaderId);
				createdProofreaders++;
			}
		}

		const tversion = item.tversion?.trim() || 'unknown';
		const translationKey = translationKeyFrom(name, tversion);
		const existingTranslationId = translationByKey.get(translationKey);

		if (!existingTranslationId) {
			if (!dryRun) {
				await db.insert(table.gameTranslation).values({
					id: crypto.randomUUID(),
					gameId,
					translationName: item.tname?.trim() || null,
					status: mapStatus(item.status),
					tversion,
					tlink: item.tlink?.trim() || '',
					tname: mapTName(item.tname),
					translatorId,
					proofreaderId,
					ttype: mapTType(item.ttype),
					ac: Boolean(item.ac)
				});
			}
			translationByKey.set(translationKey, 'created');
			insertedTranslations++;
		} else {
			if (!dryRun) {
				await db
					.update(table.gameTranslation)
					.set({
						gameId,
						translationName: item.tname?.trim() || null,
						status: mapStatus(item.status),
						tversion,
						tlink: item.tlink?.trim() || '',
						tname: mapTName(item.tname),
						translatorId,
						proofreaderId,
						ttype: mapTType(item.ttype),
						ac: Boolean(item.ac)
					})
					.where(eq(table.gameTranslation.id, existingTranslationId));
			}
			updatedTranslations++;
		}
	}

	return {
		total: games.length,
		insertedGames,
		updatedGames,
		insertedTranslations,
		updatedTranslations,
		createdTranslators,
		createdProofreaders,
		skipped
	};
};

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

	const c = config;
	const webhookStatus = {
		updates: Boolean(c?.discordWebhookUpdates?.trim()),
		logs: Boolean(c?.discordWebhookLogs?.trim()),
		translators: Boolean(c?.discordWebhookTranslators?.trim()),
		proofreaders: Boolean(c?.discordWebhookProofreaders?.trim())
	};

	return {
		config,
		webhookStatus
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
	},
	importLegacyGamesJson: async ({ request, locals }) => {
		if (!locals.user || (locals.user.role !== 'admin' && locals.user.role !== 'superadmin')) {
			return {
				success: false,
				message: 'Accès non autorisé',
				details: null
			};
		}

		const formData = await request.formData();
		const payload = String(formData.get('legacyJson') ?? '').trim();

		if (!payload) {
			return {
				success: false,
				message: 'JSON requis',
				details: 'Collez un JSON contenant un tableau "games".'
			};
		}

		try {
			const parsed = JSON.parse(payload) as unknown;
			const games = parseLegacyGames(parsed);

			if (!games || games.length === 0) {
				return {
					success: false,
					message: 'Aucun jeu trouvé',
					details: 'Le JSON doit être un tableau ou contenir { "games": [...] }.'
				};
			}

			return {
				success: true,
				message: 'Import terminé',
				details: await upsertLegacyGames(games)
			};
		} catch (error: unknown) {
			return {
				success: false,
				message: "Erreur lors de l'import",
				details: error instanceof Error ? error.message : 'Erreur inconnue'
			};
		}
	},
	syncLegacyApiTranslators: async ({ request, locals }) => {
		if (!locals.user || (locals.user.role !== 'admin' && locals.user.role !== 'superadmin')) {
			return { success: false, message: 'Accès non autorisé', details: null };
		}

		await request.formData();

		try {
			const response = await fetch(LEGACY_API_URL);
			if (!response.ok) {
				return { success: false, message: `Erreur API: ${response.status}`, details: null };
			}

			const payload = (await response.json()) as unknown;
			const translators = parseLegacyTranslators(payload);
			if (!translators || translators.length === 0) {
				return { success: false, message: 'Aucun traducteur dans data.traductors', details: null };
			}

			const details = await upsertLegacyTranslators(translators);
			return {
				success: true,
				message: 'Synchronisation traducteurs terminée',
				details
			};
		} catch (error: unknown) {
			return {
				success: false,
				message: 'Erreur pendant la synchronisation des traducteurs',
				details: error instanceof Error ? error.message : 'Erreur inconnue'
			};
		}
	},
	checkLegacyApiGames: async ({ request, locals }) => {
		if (!locals.user || (locals.user.role !== 'admin' && locals.user.role !== 'superadmin')) {
			return { success: false, message: 'Accès non autorisé', details: null };
		}
		await request.formData();

		try {
			const response = await fetch(LEGACY_API_URL);
			if (!response.ok) {
				return { success: false, message: `Erreur API: ${response.status}`, details: null };
			}
			const payload = (await response.json()) as {
				data?: { games?: LegacyGame[]; traductors?: unknown[] };
			};
			const games = payload?.data?.games ?? [];
			const translators = parseLegacyTranslators(payload) ?? [];

			if (!Array.isArray(games) && translators.length === 0) {
				return { success: false, message: 'Aucune donnée legacy exploitable', details: null };
			}

			const [gamesPreview, translatorsPreview] = await Promise.all([
				Array.isArray(games) ? upsertLegacyGames(games, { dryRun: true }) : null,
				translators.length > 0 ? upsertLegacyTranslators(translators, { dryRun: true }) : null
			]);

			return {
				success: true,
				message: 'Vérification terminée (aperçu synchronisation)',
				details: {
					games:
						gamesPreview ??
						({
							total: 0,
							insertedGames: 0,
							updatedGames: 0,
							insertedTranslations: 0,
							updatedTranslations: 0,
							createdTranslators: 0,
							createdProofreaders: 0,
							skipped: 0
						} as const),
					translators:
						translatorsPreview ??
						({
							total: 0,
							inserted: 0,
							updated: 0,
							skipped: 0
						} as const)
				}
			};
		} catch (error: unknown) {
			return {
				success: false,
				message: 'Erreur pendant la comparaison API',
				details: error instanceof Error ? error.message : 'Erreur inconnue'
			};
		}
	},
	syncLegacyApiGames: async ({ request, locals }) => {
		if (!locals.user || (locals.user.role !== 'admin' && locals.user.role !== 'superadmin')) {
			return { success: false, message: 'Accès non autorisé', details: null };
		}

		await request.formData();

		try {
			const response = await fetch(LEGACY_API_URL);
			if (!response.ok) {
				return { success: false, message: `Erreur API: ${response.status}`, details: null };
			}

			const payload = (await response.json()) as { data?: { games?: LegacyGame[] } };
			const games = payload?.data?.games ?? [];
			if (!Array.isArray(games) || games.length === 0) {
				return { success: false, message: 'Aucun game dans data.games', details: null };
			}

			const details = await upsertLegacyGames(games);
			return {
				success: true,
				message: 'Synchronisation API terminee',
				details
			};
		} catch (error: unknown) {
			return {
				success: false,
				message: 'Erreur pendant la synchronisation API',
				details: error instanceof Error ? error.message : 'Erreur inconnue'
			};
		}
	},
	cleanupDuplicateTranslations: async ({ locals }) => {
		if (!locals.user || (locals.user.role !== 'admin' && locals.user.role !== 'superadmin')) {
			return { success: false, message: 'Accès non autorisé', details: null };
		}

		try {
			const before = (await db.execute(
				sql`select count(*)::int as count from game_translation`
			)) as unknown as Array<{
				count: number;
			}>;
			const beforeCount = before[0]?.count ?? 0;

			const duplicateRows = (await db.execute(sql`
				with ranked as (
					select
						gt.id,
						lower(trim(g.name)) as nkey,
						lower(trim(gt.tversion)) as vkey,
						row_number() over (
							partition by lower(trim(g.name)), lower(trim(gt.tversion))
							order by gt.updated_at desc, gt.created_at desc, gt.id desc
						) as rn
					from game_translation gt
					join game g on g.id = gt.game_id
				)
				select id
				from ranked
				where rn > 1
			`)) as unknown as Array<{ id: string }>;

			const duplicateIds = duplicateRows.map((r) => r.id);
			if (duplicateIds.length === 0) {
				return {
					success: true,
					message: 'Aucun doublon à nettoyer',
					details: { before: beforeCount, after: beforeCount, removed: 0 }
				};
			}

			await db.transaction(async (tx) => {
				await tx.execute(sql`
					with ranked as (
						select
							gt.id,
							lower(trim(g.name)) as nkey,
							lower(trim(gt.tversion)) as vkey,
							row_number() over (
								partition by lower(trim(g.name)), lower(trim(gt.tversion))
								order by gt.updated_at desc, gt.created_at desc, gt.id desc
							) as rn
						from game_translation gt
						join game g on g.id = gt.game_id
					),
					to_keep as (
						select nkey, vkey, id as keep_id
						from ranked
						where rn = 1
					),
					to_drop as (
						select id as drop_id, nkey, vkey
						from ranked
						where rn > 1
					)
					update submission s
					set translation_id = k.keep_id
					from to_drop d
					join to_keep k on k.nkey = d.nkey and k.vkey = d.vkey
					where s.translation_id = d.drop_id
				`);

				await tx
					.delete(table.gameTranslation)
					.where(inArray(table.gameTranslation.id, duplicateIds));
			});

			const after = (await db.execute(
				sql`select count(*)::int as count from game_translation`
			)) as unknown as Array<{
				count: number;
			}>;
			const afterCount = after[0]?.count ?? beforeCount;

			return {
				success: true,
				message: 'Doublons nettoyés',
				details: {
					before: beforeCount,
					after: afterCount,
					removed: beforeCount - afterCount
				}
			};
		} catch (error: unknown) {
			return {
				success: false,
				message: 'Erreur pendant le nettoyage des doublons',
				details: error instanceof Error ? error.message : 'Erreur inconnue'
			};
		}
	},
	syncDbToSpreadsheet: async ({ request, locals }) => {
		if (!locals.user || (locals.user.role !== 'admin' && locals.user.role !== 'superadmin')) {
			return { success: false, message: 'Accès non autorisé', details: null };
		}

		await request.formData();

		try {
			const [translations, translators] = await Promise.all([
				db.select({ id: table.gameTranslation.id }).from(table.gameTranslation),
				db.select({ id: table.translator.id }).from(table.translator)
			]);

			let syncedTranslations = 0;
			let syncedTranslators = 0;
			const errors: string[] = [];

			for (const row of translations) {
				try {
					await syncTranslationToGoogleSheet(row.id);
					syncedTranslations++;
				} catch (err) {
					errors.push(
						`translation ${row.id}: ${err instanceof Error ? err.message : 'erreur inconnue'}`
					);
				}
			}

			for (const row of translators) {
				try {
					await syncTranslatorToGoogleSheet(row.id);
					syncedTranslators++;
				} catch (err) {
					errors.push(
						`translator ${row.id}: ${err instanceof Error ? err.message : 'erreur inconnue'}`
					);
				}
			}

			return {
				success: errors.length === 0,
				message:
					errors.length === 0
						? 'Synchronisation DB -> Spreadsheet terminée'
						: 'Synchronisation terminée avec erreurs',
				details: {
					totalTranslations: translations.length,
					totalTranslators: translators.length,
					syncedTranslations,
					syncedTranslators,
					errors
				}
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
		if (!locals.user || (locals.user.role !== 'admin' && locals.user.role !== 'superadmin')) {
			return {
				success: false,
				message: 'Accès non autorisé',
				details: null,
				channel: null,
				httpStatus: null as number | null
			};
		}

		const formData = await request.formData();
		const raw = formData.get('channel');
		const channel =
			raw === 'updates' || raw === 'logs' || raw === 'translators' || raw === 'proofreaders'
				? raw
				: null;

		if (!channel) {
			return {
				success: false,
				message: 'Canal invalide',
				details: null,
				channel: null,
				httpStatus: null
			};
		}

		const configResult = await db
			.select({
				discordWebhookUpdates: table.config.discordWebhookUpdates,
				discordWebhookLogs: table.config.discordWebhookLogs,
				discordWebhookTranslators: table.config.discordWebhookTranslators,
				discordWebhookProofreaders: table.config.discordWebhookProofreaders
			})
			.from(table.config)
			.where(eq(table.config.id, 'main'))
			.limit(1);

		const cfg = configResult[0];
		const urlByChannel = {
			updates: cfg?.discordWebhookUpdates,
			logs: cfg?.discordWebhookLogs,
			translators: cfg?.discordWebhookTranslators,
			proofreaders: cfg?.discordWebhookProofreaders
		} as const;

		const url = urlByChannel[channel]?.trim();
		if (!url) {
			return {
				success: false,
				message: 'Aucune URL enregistrée pour ce canal (paramètres).',
				details: null,
				channel,
				httpStatus: null
			};
		}

		const labels: Record<typeof channel, string> = {
			updates: 'Mises à jour',
			logs: 'Logs',
			translators: 'Traducteurs',
			proofreaders: 'Relecteurs'
		};

		const payload = {
			content: '',
			tts: false,
			embeds: [
				{
					title: 'Test webhook — F95 France',
					description: `Canal **${labels[channel]}** : la configuration est joignable depuis l’outil dev.`,
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
