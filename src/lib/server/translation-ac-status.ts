import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { strTrim, tradVerIndicatesIntegrated } from '$lib/server/translation-notify-rules';
import { isIntegrated, isNoTranslation } from '$lib/utils/game-form-validation';
import { and, eq } from 'drizzle-orm';

export type TranslationAcStatusInput = {
	status: string;
	tversion: string;
	tname: string;
};

export type TranslationWorkflowStatus = 'in_progress' | 'completed' | 'abandoned';

/**
 * Statut workflow après synchro auto-check de la version de référence (ac = true).
 * - Abandonné (workflow) : inchangé
 * - Intégrée : terminée
 * - Trad. ver. = nouvelle ref. : terminée
 * - Sinon : en cours (mise à jour requise)
 */
export function resolveTranslationStatusAfterAcVersionSync(
	row: TranslationAcStatusInput,
	referenceVersion: string
): TranslationWorkflowStatus {
	if (row.status === 'abandoned') return 'abandoned';
	if (isNoTranslation(row.tname)) {
		return row.status === 'completed' || row.status === 'abandoned' ? row.status : 'in_progress';
	}
	if (isIntegrated(row.tname) || tradVerIndicatesIntegrated(row.tversion, row.tname)) {
		return 'completed';
	}
	const ref = strTrim(referenceVersion);
	const tv = strTrim(row.tversion);
	if (ref !== '' && tv === ref) return 'completed';
	return 'in_progress';
}

/** Met à jour version de référence + statut pour toutes les traductions ac du jeu. */
export async function syncAcTranslationsToCheckerVersion(
	gameId: string,
	checkerVersion: string
): Promise<number> {
	const rows = await db
		.select({
			id: table.gameTranslation.id,
			status: table.gameTranslation.status,
			tversion: table.gameTranslation.tversion,
			tname: table.gameTranslation.tname
		})
		.from(table.gameTranslation)
		.where(and(eq(table.gameTranslation.gameId, gameId), eq(table.gameTranslation.ac, true)));

	if (rows.length === 0) return 0;

	const updatedAt = new Date();
	await Promise.all(
		rows.map((row) =>
			db
				.update(table.gameTranslation)
				.set({
					version: checkerVersion,
					status: resolveTranslationStatusAfterAcVersionSync(row, checkerVersion),
					updatedAt
				})
				.where(eq(table.gameTranslation.id, row.id))
		)
	);

	return rows.length;
}
