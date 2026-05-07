import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { eq, sql } from 'drizzle-orm';

type CounterKind = 'add' | 'edit';

export async function incrementUserGameCounter(
	userId: string,
	kind: CounterKind,
	by = 1
): Promise<void> {
	if (!userId || by <= 0) return;
	if (kind === 'add') {
		await db
			.update(table.user)
			.set({
				gameAdd: sql`${table.user.gameAdd} + ${by}`,
				updatedAt: new Date()
			})
			.where(eq(table.user.id, userId));
		return;
	}

	await db
		.update(table.user)
		.set({
			gameEdit: sql`${table.user.gameEdit} + ${by}`,
			updatedAt: new Date()
		})
		.where(eq(table.user.id, userId));
}
