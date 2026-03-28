import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { and, eq, ne } from 'drizzle-orm';

/** Détache un compte de tous les profils traducteur. */
export async function unlinkUserFromTranslators(userId: string) {
	await db
		.update(table.translator)
		.set({ userId: null })
		.where(eq(table.translator.userId, userId));
}

/**
 * Attache un profil traducteur à un compte (ou détache si userId est null).
 * Garantit qu’un utilisateur n’est lié qu’à un seul profil à la fois.
 */
export async function assignTranslatorUser(translatorId: string, userId: string | null) {
	if (userId) {
		await db
			.update(table.translator)
			.set({ userId: null })
			.where(and(eq(table.translator.userId, userId), ne(table.translator.id, translatorId)));
	}
	await db.update(table.translator).set({ userId }).where(eq(table.translator.id, translatorId));
}
