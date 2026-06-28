import * as table from '$lib/server/db/schema';
import { hasUpdateHistoryTable } from '$lib/server/schema-column-compat';
import { and, eq, or, sql, type SQL } from 'drizzle-orm';

export type UpdatesApiScope = 'featured' | 'all';

/**
 * Portée « featured » : aligne /updates sur le webhook Discord « updates ».
 *
 * Le webhook poste : nouveaux jeux + toute création/modification/suppression de
 * traduction. Il **n'émet pas** pour les soumissions de type `update` (édition de
 * métadonnées du jeu) — cf. `sendDiscordWebhookUpdatesSubmissionApplied`. Or ce
 * chemin (`touchGameUpdatedToday(sub.gameId)`) crée des lignes `update` sans
 * historique : il faut donc les exclure.
 *
 * Critère retenu : `adding` (nouveau jeu), OU ligne liée à un changement de
 * traduction tracé dans `update_history` (entity = 'translation', quel que soit
 * le champ — pas seulement la version). NB : les bumps de version de l'auto-check
 * ne créent aucune ligne `update`, donc cette approche SQL ne peut pas les
 * refléter (il faudrait les matérialiser à l'écriture).
 */
export async function featuredUpdatesScopeWhere(): Promise<SQL> {
	const isAdding = eq(table.update.status, 'adding');

	if (!(await hasUpdateHistoryTable())) {
		return isAdding;
	}

	const hasTranslationHistory = sql`exists (
		select 1 from ${table.updateHistory} uh
		where uh.update_id = ${table.update.id}
		and uh.changes is not null
		and json_valid(uh.changes)
		and json_unquote(json_extract(uh.changes, '$.entity')) = 'translation'
	)`;

	return or(isAdding, hasTranslationHistory)!;
}

export async function buildUpdatesListWhere(
	scope: UpdatesApiScope,
	extra?: SQL
): Promise<SQL | undefined> {
	const parts: SQL[] = [];
	if (scope === 'featured') {
		parts.push(await featuredUpdatesScopeWhere());
	}
	if (extra) parts.push(extra);
	if (parts.length === 0) return undefined;
	return parts.length === 1 ? parts[0] : and(...parts);
}
