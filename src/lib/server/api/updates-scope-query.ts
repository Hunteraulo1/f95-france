import * as table from '$lib/server/db/schema';
import { hasUpdateHistoryTable } from '$lib/server/schema-column-compat';
import { and, eq, or, sql, type SQL } from 'drizzle-orm';

export type UpdatesApiScope = 'featured' | 'all';

/**
 * Portée de la liste `/api/updates`.
 * - `featured` (défaut) : ajouts (`adding`) ou changement de version en historique
 * - `all` : toutes les entrées `update`
 */
export function parseUpdatesApiScope(searchParams: URLSearchParams): UpdatesApiScope {
	const raw = searchParams.get('scope')?.trim().toLowerCase();
	if (raw === 'all') return 'all';
	return 'featured';
}

export async function featuredUpdatesScopeWhere(): Promise<SQL> {
	const isAdding = eq(table.update.status, 'adding');

	if (!(await hasUpdateHistoryTable())) {
		return isAdding;
	}

	const hasVersionDelta = sql`exists (
		select 1 from ${table.updateHistory} uh
		where uh.update_id = ${table.update.id}
		and uh.changes is not null
		and exists (
			select 1 from jsonb_array_elements(uh.changes::jsonb->'deltas') as delta
			where (delta->>'field' = 'version' or delta->>'field' = 'tversion')
			and coalesce(delta->>'oldValue', '') is distinct from coalesce(delta->>'newValue', '')
		)
	)`;

	return or(isAdding, hasVersionDelta)!;
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
