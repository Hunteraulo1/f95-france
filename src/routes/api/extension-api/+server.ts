import { db } from '$lib/server/db';
import { game, gameTranslation, translator, update as updateTable } from '$lib/server/db/schema';
import { json } from '@sveltejs/kit';
import { desc, eq, inArray } from 'drizzle-orm';
import type { RequestHandler } from './$types';

const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

export const OPTIONS: RequestHandler = async () =>
	new Response(null, {
		status: 204,
		headers: corsHeaders
	});

const mapDomain = (website: string | null | undefined): 'F95z' | 'LewdCorner' | 'Autre' | 'Unknown' => {
	switch ((website ?? '').trim().toLowerCase()) {
		case 'f95z':
			return 'F95z';
		case 'lc':
			return 'LewdCorner';
		case 'other':
			return 'Autre';
		default:
			return 'Unknown';
	}
};

const mapHostname = (website: string | null | undefined): 'f95zone.to' | 'lewdcorner.com' | null => {
	switch ((website ?? '').trim().toLowerCase()) {
		case 'f95z':
			return 'f95zone.to';
		case 'lc':
			return 'lewdcorner.com';
		default:
			return null;
	}
};

const mapTName = (
	v: string | null | undefined
): 'Traduction' | 'Traduction (mod inclus)' | 'Intégrée' | 'Pas de traduction' => {
	switch ((v ?? '').trim().toLowerCase()) {
		case 'translation_with_mods':
			return 'Traduction (mod inclus)';
		case 'integrated':
			return 'Intégrée';
		case 'no_translation':
			return 'Pas de traduction';
		case 'translation':
		default:
			return 'Traduction';
	}
};

const mapStatus = (v: string | null | undefined): 'EN COURS' | 'TERMINÉ' | 'ABANDONNÉ' => {
	switch ((v ?? '').trim().toLowerCase()) {
		case 'completed':
			return 'TERMINÉ';
		case 'abandoned':
			return 'ABANDONNÉ';
		case 'in_progress':
		default:
			return 'EN COURS';
	}
};

const mapType = (
	v: string | null | undefined
):
	| 'RenPy'
	| 'RPGM'
	| 'Unity'
	| 'Unreal'
	| 'Flash'
	| 'HTLM'
	| 'QSP'
	| 'Autre'
	| 'RenPy/RPGM'
	| 'RenPy/Unity' => {
	switch ((v ?? '').trim().toLowerCase()) {
		case 'renpy':
			return 'RenPy';
		case 'rpgm':
			return 'RPGM';
		case 'unity':
			return 'Unity';
		case 'unreal':
			return 'Unreal';
		case 'flash':
			return 'Flash';
		case 'html':
			return 'HTLM';
		case 'qsp':
			return 'QSP';
		case 'renpy/rpgm':
			return 'RenPy/RPGM';
		case 'renpy/unity':
			return 'RenPy/Unity';
		default:
			return 'Autre';
	}
};

const mapTType = (
	v: string | null | undefined
):
	| 'Traduction Humaine'
	| 'Traduction Automatique'
	| 'Traduction Semi-Automatique'
	| 'VO Française'
	| 'À tester'
	| 'Lien Trad HS' => {
	switch ((v ?? '').trim().toLowerCase()) {
		case 'manual':
			return 'Traduction Humaine';
		case 'auto':
			return 'Traduction Automatique';
		case 'semi-auto':
			return 'Traduction Semi-Automatique';
		case 'vf':
			return 'VO Française';
		case 'to_tested':
			return 'À tester';
		case 'hs':
		default:
			return 'Lien Trad HS';
	}
};

const splitTags = (raw: string | null | undefined): string[] =>
	(raw ?? '')
		.split(',')
		.map((t) => t.trim())
		.filter(Boolean);

type ParsedPage = { title: string; link: string };

const parsePages = (raw: string | null | undefined): ParsedPage[] => {
	if (!raw || !raw.trim()) return [];
	try {
		const parsed = JSON.parse(raw) as unknown;
		if (!Array.isArray(parsed)) return [];
		return parsed
			.map((p) => {
				if (!p || typeof p !== 'object') return null;
				const obj = p as Record<string, unknown>;
				const title =
					(typeof obj.title === 'string' && obj.title.trim()) ||
					(typeof obj.name === 'string' && obj.name.trim()) ||
					(typeof obj.label === 'string' && obj.label.trim()) ||
					'';
				const link = (typeof obj.link === 'string' && obj.link.trim()) || '';
				if (!title && !link) return null;
				return { title: title || link, link };
			})
			.filter((v): v is ParsedPage => v !== null);
	} catch {
		return [];
	}
};

const firstPageLink = (raw: string | null | undefined): string | null => {
	const first = parsePages(raw)[0];
	return first?.link?.trim() ? first.link.trim() : null;
};

const mapUpdateType = (v: string | null | undefined): 'AJOUT DE JEU' | 'MISE À JOUR' =>
	(v ?? '').trim().toLowerCase() === 'adding' ? 'AJOUT DE JEU' : 'MISE À JOUR';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const gameId = url.searchParams.get('gameId')?.trim();

		const baseQuery = db
			.select({
				game: {
					id: game.id,
					name: game.name,
					description: game.description,
					website: game.website,
					threadId: game.threadId,
					link: game.link,
					tags: game.tags,
					type: game.type,
					image: game.image,
					gameAutoCheck: game.gameAutoCheck,
					gameVersion: game.gameVersion,
					createdAt: game.createdAt,
					updatedAt: game.updatedAt
				},
				translation: {
					id: gameTranslation.id,
					gameId: gameTranslation.gameId,
					translationName: gameTranslation.translationName,
					version: gameTranslation.version,
					status: gameTranslation.status,
					tversion: gameTranslation.tversion,
					tlink: gameTranslation.tlink,
					tname: gameTranslation.tname,
					translatorId: gameTranslation.translatorId,
					proofreaderId: gameTranslation.proofreaderId,
					ttype: gameTranslation.ttype,
					ac: gameTranslation.ac,
					createdAt: gameTranslation.createdAt,
					updatedAt: gameTranslation.updatedAt
				}
			})
			.from(gameTranslation)
			.innerJoin(game, eq(gameTranslation.gameId, game.id));

		const rows = gameId
			? await baseQuery
					.where(eq(gameTranslation.gameId, gameId))
					.orderBy(desc(gameTranslation.updatedAt))
			: await baseQuery.orderBy(desc(gameTranslation.updatedAt));

		const translatorIds = Array.from(
			new Set(
				rows.flatMap((row) =>
					[row.translation.translatorId, row.translation.proofreaderId].filter(
						(id): id is string => Boolean(id)
					)
				)
			)
		);

		const translatorRows =
			translatorIds.length > 0
				? await db
						.select({
							id: translator.id,
							name: translator.name,
							pages: translator.pages
						})
						.from(translator)
						.where(inArray(translator.id, translatorIds))
				: [];

		const translatorById = new Map(translatorRows.map((tr) => [tr.id, tr]));

		const gamesWithDbId = rows.map((row) => {
			const tr = row.translation.translatorId ? translatorById.get(row.translation.translatorId) : null;
			const pr = row.translation.proofreaderId ? translatorById.get(row.translation.proofreaderId) : null;
			const payload = {
        id: row.translation.id,
        gameId: row.game.id,
				threadId: row.game.threadId ?? null,
				domain: mapDomain(row.game.website),
				hostname: mapHostname(row.game.website),
				name: row.game.name,
				version: row.game.gameVersion ?? '',
				tversion: row.translation.tversion,
				tname: mapTName(row.translation.tname),
				status: mapStatus(row.translation.status),
				tags: splitTags(row.game.tags),
				type: mapType(row.game.type),
				traductor: tr?.name ?? null,
				proofreader: pr?.name ?? null,
				ttype: mapTType(row.translation.ttype),
				ac: Boolean(row.translation.ac),
				link: row.game.link,
				tlink: row.translation.tlink?.trim() ? row.translation.tlink : null,
				trlink: firstPageLink(tr?.pages),
				prlink: firstPageLink(pr?.pages),
				image: row.game.image?.trim() ? row.game.image : null
			};
			return { gameDbId: row.game.id, payload };
		});

		const gamesByDbId = new Map<string, Array<(typeof gamesWithDbId)[number]['payload']>>();
		for (const g of gamesWithDbId) {
			const current = gamesByDbId.get(g.gameDbId) ?? [];
			current.push(g.payload);
			gamesByDbId.set(g.gameDbId, current);
		}

		const updates = await db
			.select({
				date: updateTable.createdAt,
				type: updateTable.status,
				gameId: updateTable.gameId
			})
			.from(updateTable)
			.orderBy(desc(updateTable.createdAt));

		const mappedUpdates = updates.map((u) => {
			const updateGames = gamesByDbId.get(u.gameId) ?? [];
			return {
				date: u.date,
				type: mapUpdateType(u.type),
				names: updateGames.map((g) => g.name)
			};
		});

		const traductorsRows = await db
			.select({
				name: translator.name,
				pages: translator.pages,
				discordId: translator.discordId,
				tradCount: translator.tradCount,
				readCount: translator.readCount
			})
			.from(translator)
			.orderBy(translator.name);

		const traductors = traductorsRows.map((t) => ({
			name: t.name,
			pages: parsePages(t.pages),
			discordId: t.discordId ? Number.parseInt(t.discordId, 10) || null : null,
			tradCount: t.tradCount ?? 0,
			readCount: t.readCount ?? 0,
			score: (t.tradCount ?? 0) + (t.readCount ?? 0)
		}));

		return json(
			{
				data: {
					games: gamesWithDbId.map((g) => g.payload),
					updates: mappedUpdates,
					traductors
				}
			},
			{
				headers: corsHeaders
			}
		);
	} catch (error) {
		console.error('Error fetching extension api data:', error);
		return json(
			{ error: 'Failed to fetch extension api data' },
			{
				status: 500,
				headers: corsHeaders
			}
		);
	}
};
