import { assertDashboardAuthenticated } from '$lib/server/dashboard-auth';
import { loadDashboardTranslatorsPage } from '$lib/server/dashboard-translators-page-load';
import { getDiscordAvatarUrl } from '$lib/server/discord-oauth';
import { assertPermission, hasPermission } from '$lib/server/permissions';
import { handleTranslatorPagesUpdate } from '$lib/server/translator-pages-write';
import { assignTranslatorUser } from '$lib/server/translator-user-link';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { randomUUID } from 'node:crypto';
import { fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

async function setUserAvatarFromDiscordIdIfMissing(userId: string, discordId: string | null) {
	const normalizedDiscordId = discordId?.trim();
	if (!normalizedDiscordId) return;

	const [currentUser] = await db
		.select({ avatar: table.user.avatar })
		.from(table.user)
		.where(eq(table.user.id, userId))
		.limit(1);

	if (!currentUser || currentUser.avatar.trim() !== '') return;

	try {
		const avatarUrl = await getDiscordAvatarUrl(normalizedDiscordId);
		if (!avatarUrl) return;

		await db.update(table.user).set({ avatar: avatarUrl }).where(eq(table.user.id, userId));
	} catch (error: unknown) {
		console.error("Erreur lors de la récupération de l'avatar Discord:", error);
	}
}

export const load: PageServerLoad = async ({ locals, url }) => {
	assertDashboardAuthenticated(locals);

	const q = (url.searchParams.get('q') ?? '').trim().slice(0, 100);

	return loadDashboardTranslatorsPage({ locals, q, requestedPage: 1 });
};

export const actions: Actions = {
	addTranslator: async ({ request, locals }) => {
		await assertPermission(locals, 'translators.manage');
		const formData = await request.formData();
		const name = formData.get('name') as string;
		const discordId = formData.get('discordId') as string;
		const pages = formData.get('pages') as string;
		const linkUserRaw = formData.get('userId');
		const linkUserId =
			typeof linkUserRaw === 'string' && linkUserRaw.trim() ? linkUserRaw.trim() : null;

		if (!name) {
			return fail(400, { message: 'Le nom est requis' });
		}

		try {
			if (linkUserId) {
				const userRow = await db
					.select({ id: table.user.id })
					.from(table.user)
					.where(eq(table.user.id, linkUserId))
					.limit(1);
				if (!userRow[0]) {
					return fail(400, { message: 'Utilisateur introuvable pour le lien' });
				}
			}

			const pagesArray = pages ? JSON.parse(pages) : [];

			const createdId = randomUUID();
			await db.insert(table.translator).values({
				id: createdId,
				name,
				discordId: discordId || null,
				pages: JSON.stringify(pagesArray)
			});

			if (linkUserId) {
				await assignTranslatorUser(createdId, linkUserId);
				await setUserAvatarFromDiscordIdIfMissing(linkUserId, discordId || null);
			}

			return { success: true, message: 'Traducteur ajouté avec succès' };
		} catch (error: unknown) {
			console.error("Erreur lors de l'ajout du traducteur:", error);

			// Vérifier si c'est une erreur de duplication
			const mysqlError =
				error && typeof error === 'object' && 'cause' in error
					? (error.cause as { code?: string; errno?: number; sqlMessage?: string })
					: null;

			if (mysqlError && (mysqlError.code === 'ER_DUP_ENTRY' || mysqlError.errno === 1062)) {
				if (mysqlError.sqlMessage?.includes('translator_name_unique')) {
					return fail(409, { message: `Un traducteur avec le nom "${name}" existe déjà` });
				}
				if (mysqlError.sqlMessage?.includes('discord_id')) {
					return fail(409, { message: `Un traducteur avec cet ID Discord existe déjà` });
				}
				return fail(409, { message: 'Ce traducteur existe déjà' });
			}

			return fail(500, { message: "Erreur lors de l'ajout du traducteur" });
		}
	},

	editTranslator: async ({ request, locals }) => {
		await assertPermission(locals, 'translators.manage');
		const formData = await request.formData();
		const id = formData.get('id') as string;
		const name = formData.get('name') as string;
		const discordId = formData.get('discordId') as string;
		const pages = formData.get('pages') as string;
		const linkUserRaw = formData.get('userId');
		const linkUserId =
			typeof linkUserRaw === 'string' && linkUserRaw.trim() ? linkUserRaw.trim() : null;

		if (!id || !name) {
			return fail(400, { message: 'ID et nom requis' });
		}

		try {
			if (linkUserId) {
				const userRow = await db
					.select({ id: table.user.id })
					.from(table.user)
					.where(eq(table.user.id, linkUserId))
					.limit(1);
				if (!userRow[0]) {
					return fail(400, { message: 'Utilisateur introuvable pour le lien' });
				}
			}

			const pagesArray = pages ? JSON.parse(pages) : [];

			await db
				.update(table.translator)
				.set({
					name,
					discordId: discordId || null,
					pages: JSON.stringify(pagesArray)
				})
				.where(eq(table.translator.id, id));

			await assignTranslatorUser(id, linkUserId);
			if (linkUserId) {
				await setUserAvatarFromDiscordIdIfMissing(linkUserId, discordId || null);
			}

			return { success: true, message: 'Traducteur modifié avec succès' };
		} catch (error: unknown) {
			console.error('Erreur lors de la modification du traducteur:', error);

			// Vérifier si c'est une erreur de duplication
			const mysqlError =
				error && typeof error === 'object' && 'cause' in error
					? (error.cause as { code?: string; errno?: number; sqlMessage?: string })
					: null;

			if (mysqlError && (mysqlError.code === 'ER_DUP_ENTRY' || mysqlError.errno === 1062)) {
				if (mysqlError.sqlMessage?.includes('translator_name_unique')) {
					return fail(409, { message: `Un traducteur avec le nom "${name}" existe déjà` });
				}
				if (mysqlError.sqlMessage?.includes('discord_id')) {
					return fail(409, { message: `Un traducteur avec cet ID Discord existe déjà` });
				}
				return fail(409, { message: 'Ce traducteur existe déjà' });
			}

			return fail(500, { message: 'Erreur lors de la modification du traducteur' });
		}
	},
	requestTranslatorPagesUpdate: async (event) => {
		const hasGamesManage = hasPermission(event.locals, 'games.manage');
		const result = await handleTranslatorPagesUpdate(event, { hasGamesManage });
		if (!result.ok) {
			return fail(result.status, { message: result.message });
		}
		return { success: true, message: result.message, mode: result.mode };
	}
};
