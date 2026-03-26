import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { getValidAccessToken } from '$lib/server/google-oauth';
import { scrapeF95Thread } from '$lib/server/scrape/f95';
import { eq, inArray, sql } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

const LEGACY_API_URL =
	'https://script.googleusercontent.com/macros/echo?user_content_key=AWDtjMWlhcPyHDwbzHY3KDJW29hXDREFp6fFEGqWkX4p6ebClNugJpo5PhNNOAlXzAVwKEDOyuPRHtxcxZOry7cW9HiMJwupr8WDEDha-BeMcFvNflxT8Re408akwtbRX8BVwL6WuNiGj7VC9RtythogETklkzqLqhwE-ZK4Z5gbt5UhBdcGnsw2miRsBU7o7HgbECsWkeN01kKaTPro3E6IY0-3DyfbcmKSlq2Bto_hEV6TiBuQughUEchXCSB2qCAScbO5CWIXLgCKhF9n-3GLYwXYVi5Keg&lib=MmJ3_wIeYZIsSQ7lBCVS01d4QdpKO_nee';

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
	version: string | null | undefined
): string => `${normalizeKeyPart(name)}:${normalizeKeyPart(version)}`;

const upsertLegacyGames = async (games: LegacyGame[]) => {
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
			image: table.game.image
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
			version: table.gameTranslation.version,
			gameName: table.game.name
		})
		.from(table.gameTranslation)
		.innerJoin(table.game, eq(table.game.id, table.gameTranslation.gameId));
	const translationByKey = new Map<string, string>();
	for (const row of existingTranslations) {
		translationByKey.set(translationKeyFrom(row.gameName, row.version), row.id);
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
		if (gameId) {
			const prev = gamesSnapshot.get(gameId);
			const nextValues = {
				name,
				type: mapType(item.type),
				tags,
				image: item.image?.trim() || '',
				website,
				threadId: threadId && Number.isFinite(threadId) ? threadId : null,
				link
			};
			if (
				!prev ||
				prev.name !== nextValues.name ||
				prev.type !== nextValues.type ||
				prev.tags !== nextValues.tags ||
				prev.image !== nextValues.image ||
				prev.website !== nextValues.website ||
				prev.threadId !== nextValues.threadId ||
				prev.link !== nextValues.link
			) {
				await db.update(table.game).set(nextValues).where(eq(table.game.id, gameId));
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
				link
			};
			await db.insert(table.game).values(row);
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
				translatorId = crypto.randomUUID();
				await db
					.insert(table.translator)
					.values({ id: translatorId, name: translatorName, pages: '[]' });
				translatorByName.set(translatorName.toLowerCase(), translatorId);
				createdTranslators++;
			}
		}

		const proofreaderName = item.proofreader?.trim();
		let proofreaderId: string | null = null;
		if (proofreaderName) {
			proofreaderId = translatorByName.get(proofreaderName.toLowerCase()) ?? null;
			if (!proofreaderId) {
				proofreaderId = crypto.randomUUID();
				await db
					.insert(table.translator)
					.values({ id: proofreaderId, name: proofreaderName, pages: '[]' });
				translatorByName.set(proofreaderName.toLowerCase(), proofreaderId);
				createdProofreaders++;
			}
		}

		const version = item.version?.trim() || 'unknown';
		const tversion = item.tversion?.trim() || 'unknown';
		const translationKey = translationKeyFrom(name, version);
		const existingTranslationId = translationByKey.get(translationKey);

		if (!existingTranslationId) {
			await db.insert(table.gameTranslation).values({
				id: crypto.randomUUID(),
				gameId,
				translationName: item.tname?.trim() || null,
				status: mapStatus(item.status),
				version,
				tversion,
				tlink: item.tlink?.trim() || '',
				tname: mapTName(item.tname),
				translatorId,
				proofreaderId,
				ttype: mapTType(item.ttype),
				ac: Boolean(item.ac)
			});
			translationByKey.set(translationKey, 'created');
			insertedTranslations++;
		} else {
			await db
				.update(table.gameTranslation)
				.set({
					gameId,
					translationName: item.tname?.trim() || null,
					status: mapStatus(item.status),
					version,
					tversion,
					tlink: item.tlink?.trim() || '',
					tname: mapTName(item.tname),
					translatorId,
					proofreaderId,
					ttype: mapTType(item.ttype),
					ac: Boolean(item.ac)
				})
				.where(eq(table.gameTranslation.id, existingTranslationId));
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
	checkLegacyApiGames: async ({ request, locals }) => {
		if (!locals.user || (locals.user.role !== 'admin' && locals.user.role !== 'superadmin')) {
			return { success: false, message: 'Accès non autorisé', details: null };
		}
		const formData = await request.formData();
		const apiUrl = String(formData.get('apiUrl') ?? '').trim() || LEGACY_API_URL;

		try {
			const response = await fetch(apiUrl);
			if (!response.ok) {
				return { success: false, message: `Erreur API: ${response.status}`, details: null };
			}
			const payload = (await response.json()) as { data?: { games?: LegacyGame[] } };
			const games = payload?.data?.games ?? [];
			if (!Array.isArray(games) || games.length === 0) {
				return { success: false, message: 'Aucun game dans data.games', details: null };
			}

			const existingGames = await db
				.select({
					id: table.game.id,
					threadId: table.game.threadId,
					website: table.game.website,
					link: table.game.link,
					name: table.game.name,
					type: table.game.type,
					tags: table.game.tags,
					image: table.game.image
				})
				.from(table.game);
			const existingTranslations = await db
				.select({
					version: table.gameTranslation.version,
					gameName: table.game.name
				})
				.from(table.gameTranslation)
				.innerJoin(table.game, eq(table.game.id, table.gameTranslation.gameId));

			const gamesByThread = new Map<string, (typeof existingGames)[number]>();
			const gamesByLink = new Map<string, (typeof existingGames)[number]>();
			for (const g of existingGames) {
				if (g.threadId !== null && g.threadId !== undefined) {
					gamesByThread.set(`${g.website}:${g.threadId}`, g);
				}
				if (g.link) gamesByLink.set(g.link, g);
			}
			const transByKey = new Set<string>();
			for (const t of existingTranslations) {
				transByKey.add(translationKeyFrom(t.gameName, t.version));
			}

			const missingGames: Array<{
				id: string | number | null;
				name: string;
				domain: string | null;
			}> = [];
			const missingTranslations: Array<{
				id: string | number | null;
				name: string;
				version: string;
			}> = [];
			const missingGameKeys = new Set<string>();
			const missingTranslationKeys = new Set<string>();
			const outdatedGames: Array<{ id: string | number | null; name: string; reason: string }> = [];
			for (const item of games) {
				const threadId =
					typeof item.id === 'number'
						? item.id
						: typeof item.id === 'string'
							? Number.parseInt(item.id, 10)
							: null;
				const website = mapWebsite(item.domain);
				const link = item.link?.trim() ?? '';
				const local =
					(threadId && Number.isFinite(threadId)
						? gamesByThread.get(`${website}:${threadId}`)
						: undefined) || (link ? gamesByLink.get(link) : undefined);
				if (!local) {
					const mg = {
						id: item.id ?? null,
						name: item.name?.trim() || '(sans nom)',
						domain: item.domain ?? null
					};
					const key = `${mg.id}|${mg.name}|${mg.domain ?? ''}`;
					if (!missingGameKeys.has(key)) {
						missingGameKeys.add(key);
						missingGames.push(mg);
					}
					continue;
				}
				const expectedType = mapType(item.type);
				const version = item.version?.trim() || 'unknown';
				if (!transByKey.has(translationKeyFrom(item.name?.trim() || local.name, version))) {
					const mt = {
						id: item.id ?? null,
						name: item.name?.trim() || local.name,
						version
					};
					const key = `${mt.id}|${mt.name}|${mt.version}`;
					if (!missingTranslationKeys.has(key)) {
						missingTranslationKeys.add(key);
						missingTranslations.push(mt);
					}
					continue;
				}
				if (local.type !== expectedType || local.name !== (item.name?.trim() || local.name)) {
					outdatedGames.push({
						id: item.id ?? null,
						name: item.name?.trim() || local.name,
						reason: 'Metadonnees jeu differentes (nom/type)'
					});
				}
			}

			return {
				success: true,
				message: 'Comparaison terminee',
				details: {
					totalApiGames: games.length,
					missingCount: missingGames.length,
					missingTranslationsCount: missingTranslations.length,
					outdatedCount: outdatedGames.length,
					missingGames: missingGames.slice(0, 100),
					missingTranslations: missingTranslations.slice(0, 100),
					outdatedGames: outdatedGames.slice(0, 100)
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

		const formData = await request.formData();
		const apiUrl = String(formData.get('apiUrl') ?? '').trim() || LEGACY_API_URL;

		try {
			const response = await fetch(apiUrl);
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
						lower(trim(gt.version)) as vkey,
						row_number() over (
							partition by lower(trim(g.name)), lower(trim(gt.version))
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
							lower(trim(gt.version)) as vkey,
							row_number() over (
								partition by lower(trim(g.name)), lower(trim(gt.version))
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
	}
};
