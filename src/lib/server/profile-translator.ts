import { parseTranslatorPages } from '$lib/profile/custom-profile';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export async function loadTranslatorPagesForUser(userId: string) {
	const [row] = await db
		.select({
			id: table.translator.id,
			name: table.translator.name,
			pages: table.translator.pages,
			discordNotificationsEnabled: table.translator.discordNotificationsEnabled
		})
		.from(table.translator)
		.where(eq(table.translator.userId, userId))
		.limit(1);

	if (!row) {
		return { translator: null, links: [] };
	}

	return {
		translator: {
			id: row.id,
			name: row.name,
			discordNotificationsEnabled: row.discordNotificationsEnabled
		},
		links: parseTranslatorPages(row.pages)
	};
}

/**
 * Bascule auto-service (traducteur lié uniquement) : coupe/réactive le MP Discord
 * + le repli canal pour ses propres notifications de montée de version.
 */
export async function setTranslatorDiscordNotificationsEnabled(
	userId: string,
	translatorId: string,
	enabled: boolean
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
	const [translatorRow] = await db
		.select({ id: table.translator.id, userId: table.translator.userId })
		.from(table.translator)
		.where(eq(table.translator.id, translatorId))
		.limit(1);

	if (!translatorRow || translatorRow.userId !== userId) {
		return {
			ok: false,
			status: 403,
			message: 'Vous pouvez modifier uniquement votre profil traducteur lié.'
		};
	}

	await db
		.update(table.translator)
		.set({ discordNotificationsEnabled: enabled, updatedAt: new Date() })
		.where(eq(table.translator.id, translatorId));

	return { ok: true };
}
