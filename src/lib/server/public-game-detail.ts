import { splitGameTags, websiteLabel } from '$lib/games/public-game-display';
import { translationsByGameIds } from '$lib/server/api/games-with-translations';
import {
	effectiveTranslationVersion,
	isTranslationOutdated
} from '$lib/server/api/translation-public';
import { db } from '$lib/server/db';
import { enginesPerGameSubquery } from '$lib/server/db/engines-per-game-subquery';
import { game, translator, update as updateTable } from '$lib/server/db/schema';
import { tradVerIndicatesIntegrated } from '$lib/server/translation-notify-rules';
import { error } from '@sveltejs/kit';
import { desc, eq, inArray } from 'drizzle-orm';

export type PublicGameTranslationView = {
	id: string;
	translationName: string | null;
	version: string | null;
	status: string;
	tversion: string;
	tlink: string;
	ttype: string;
	tname: string;
	gameType: string;
	ac: boolean;
	translatorName: string | null;
	proofreaderName: string | null;
	isOutdated: boolean;
	isIntegrated: boolean;
	referenceVersion: string | null;
	createdAt: Date;
	updatedAt: Date;
};

export type PublicGameDetail = {
	id: string;
	name: string;
	description: string | null;
	website: string;
	websiteLabel: string;
	threadId: number | null;
	link: string;
	tags: string[];
	image: string;
	gameVersion: string | null;
	engineTypes: string[];
	createdAt: Date;
	updatedAt: Date;
	translations: PublicGameTranslationView[];
	recentUpdates: { id: string; status: string; createdAt: Date }[];
};

async function loadTranslatorNames(ids: string[]): Promise<Map<string, string>> {
	const unique = [...new Set(ids.filter(Boolean))];
	if (unique.length === 0) return new Map();

	const rows = await db
		.select({ id: translator.id, name: translator.name })
		.from(translator)
		.where(inArray(translator.id, unique));

	return new Map(rows.map((r) => [r.id, r.name]));
}

export async function loadPublicGameDetail(gameId: string): Promise<PublicGameDetail> {
	const [row] = await db
		.select({
			id: game.id,
			name: game.name,
			description: game.description,
			website: game.website,
			threadId: game.threadId,
			link: game.link,
			tags: game.tags,
			image: game.image,
			gameVersion: game.gameVersion,
			createdAt: game.createdAt,
			updatedAt: game.updatedAt,
			engineTypes: enginesPerGameSubquery.engineTypes
		})
		.from(game)
		.leftJoin(enginesPerGameSubquery, eq(game.id, enginesPerGameSubquery.gameId))
		.where(eq(game.id, gameId))
		.limit(1);

	if (!row) {
		throw error(404, 'Jeu non trouvé');
	}

	const [translationsByGame, recentUpdates] = await Promise.all([
		translationsByGameIds([gameId]),
		db
			.select({
				id: updateTable.id,
				status: updateTable.status,
				createdAt: updateTable.createdAt
			})
			.from(updateTable)
			.where(eq(updateTable.gameId, gameId))
			.orderBy(desc(updateTable.createdAt))
			.limit(5)
	]);

	const merged = translationsByGame.get(gameId) ?? [];

	const translatorIds = merged.flatMap(
		(t) => [t.translatorId, t.proofreaderId].filter(Boolean) as string[]
	);
	const translatorNames = await loadTranslatorNames(translatorIds);

	const translations: PublicGameTranslationView[] = merged.map((t) => {
		const isIntegrated = tradVerIndicatesIntegrated(t.tversion, t.tname);
		const isOutdated = isTranslationOutdated(
			{ version: t.version, tversion: t.tversion, tname: t.tname },
			row.gameVersion
		);
		const referenceVersion = effectiveTranslationVersion(t.version, row.gameVersion);

		return {
			id: t.id,
			translationName: t.translationName,
			version: t.version,
			status: t.status,
			tversion: t.tversion,
			tlink: t.tlink,
			ttype: t.ttype,
			tname: t.tname,
			gameType: t.gameType,
			ac: t.ac,
			translatorName: t.translatorId ? (translatorNames.get(t.translatorId) ?? null) : null,
			proofreaderName: t.proofreaderId ? (translatorNames.get(t.proofreaderId) ?? null) : null,
			isOutdated,
			isIntegrated,
			referenceVersion,
			createdAt: t.createdAt,
			updatedAt: t.updatedAt
		};
	});

	return {
		id: row.id,
		name: row.name,
		description: row.description,
		website: row.website,
		websiteLabel: websiteLabel(row.website),
		threadId: row.threadId,
		link: row.link,
		tags: splitGameTags(row.tags),
		image: row.image,
		gameVersion: row.gameVersion,
		engineTypes: Array.isArray(row.engineTypes) ? row.engineTypes.map(String) : [],
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
		translations,
		recentUpdates
	};
}
