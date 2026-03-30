import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

/** L’auto-check jeu (et donc sur les traductions) n’a de sens que pour les jeux F95Zone. */
export function gameAutoCheckEnabledForWebsite(website: string): boolean {
	return website === 'f95z';
}

/**
 * Valeur à persister pour `game.game_auto_check` : forcée à `false` si le site n’est pas F95Zone.
 */
export function resolveGameAutoCheckForWebsite(
	website: string,
	requested: boolean | null | undefined,
	fallback: boolean
): boolean {
	if (!gameAutoCheckEnabledForWebsite(website)) return false;
	if (requested !== undefined && requested !== null) return Boolean(requested);
	return fallback;
}

/**
 * Indique si une traduction *peut* avoir l’auto-check activé : F95 + auto-check jeu actif.
 * Règle : `ac === true` ⇒ auto-check jeu actif (et F95) ; l’inverse est faux : jeu avec auto-check
 * activé n’impose pas `ac` sur les traductions.
 */
export async function getGameAllowsTranslationAutoCheck(gameId: string): Promise<boolean> {
	const rows = await db
		.select({ gameAutoCheck: table.game.gameAutoCheck, website: table.game.website })
		.from(table.game)
		.where(eq(table.game.id, gameId))
		.limit(1);
	const r = rows[0];
	if (!r) return false;
	if (!gameAutoCheckEnabledForWebsite(r.website)) return false;
	return r.gameAutoCheck !== false;
}

/** Si l’auto-check traduction n’est pas autorisé, force `false` ; sinon conserve la demande. */
export function clampTranslationAc(
	allowed: boolean,
	requested: boolean | null | undefined
): boolean {
	if (!allowed) return false;
	return Boolean(requested);
}

export async function clearAllTranslationAutoCheckForGame(gameId: string): Promise<void> {
	await db
		.update(table.gameTranslation)
		.set({ ac: false, updatedAt: new Date() })
		.where(eq(table.gameTranslation.gameId, gameId));
}
