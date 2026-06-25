import * as table from '$lib/server/db/schema';
import { hasUpdateHistoryTable } from '$lib/server/schema-column-compat';
import { and, eq, or, sql, type SQL } from 'drizzle-orm';

export type UpdatesApiScope = 'featured' | 'all';

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
			select 1 from JSON_TABLE(uh.changes, '$.deltas[*]' COLUMNS (
				delta_field VARCHAR(255) PATH '$.field',
				old_val TEXT PATH '$.oldValue',
				new_val TEXT PATH '$.newValue'
			)) as delta
			where (delta.delta_field = 'version' or delta.delta_field = 'tversion')
			and not (coalesce(delta.old_val, '') <=> coalesce(delta.new_val, ''))
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
