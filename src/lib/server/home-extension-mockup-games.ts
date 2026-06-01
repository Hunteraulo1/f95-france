import type { HomeExtensionMockupGame } from '$lib/home-extension-mockup';
import type { GameTranslationRow } from '$lib/server/api/games-with-translations';
import { translationsByGameIds } from '$lib/server/api/games-with-translations';
import { isTranslationOutdated } from '$lib/server/api/translation-public';
import { db } from '$lib/server/db';
import { game } from '$lib/server/db/schema';
import { tradVerIndicatesIntegrated } from '$lib/server/translation-notify-rules';
import { and, eq, isNotNull, ne, sql } from 'drizzle-orm';

export type { HomeExtensionMockupGame };

function pickPrimaryTranslation(translations: GameTranslationRow[]): GameTranslationRow | null {
	if (translations.length === 0) return null;
	const vf = translations.find((t) => t.ttype === 'vf');
	if (vf) return vf;
	const completed = translations.find((t) => t.status === 'completed');
	if (completed) return completed;
	return translations[0];
}

function extensionPreviewImageUrl(image: string | null): string {
	const raw = image?.trim();
	if (!raw) return '';
	return raw.replace('attachments.f95zone.to', 'preview.f95zone.to');
}

/** Jeux F95zone aléatoires pour le mockup extension sur la page d’accueil. */
export async function listHomeExtensionMockupGames(limit = 4): Promise<HomeExtensionMockupGame[]> {
	const rows = await db
		.select({
			id: game.id,
			name: game.name,
			image: game.image,
			gameVersion: game.gameVersion
		})
		.from(game)
		.where(
			and(
				eq(game.website, 'f95z'),
				isNotNull(game.image),
				ne(game.image, ''),
				isNotNull(game.name),
				ne(game.name, '')
			)
		)
		.orderBy(sql`random()`)
		.limit(limit);

	if (rows.length === 0) return [];

	const byGame = await translationsByGameIds(rows.map((r) => r.id));

	return rows.map((row) => {
		const translations = byGame.get(row.id) ?? [];
		const primary = pickPrimaryTranslation(translations);
		const gameVersion = row.gameVersion?.trim() || null;

		if (!primary) {
			return {
				id: row.id,
				name: row.name,
				image: extensionPreviewImageUrl(row.image),
				tversion: 'n/a',
				upToDate: false
			};
		}

		const isIntegrated = tradVerIndicatesIntegrated(primary.tversion, primary.tname);
		const upToDate = !isTranslationOutdated(primary, gameVersion);
		const tversionRaw = primary.tversion?.trim() || 'n/a';
		const tversion = isIntegrated ? 'Intégrée' : tversionRaw;

		return {
			id: row.id,
			name: row.name,
			image: extensionPreviewImageUrl(row.image),
			tversion,
			upToDate: isIntegrated || upToDate
		};
	});
}
