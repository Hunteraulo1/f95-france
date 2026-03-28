import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { assignTranslatorUser } from '$lib/server/translator-user-link';
import { fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [translator, users] = await Promise.all([
		db
			.select({
				id: table.translator.id,
				name: table.translator.name,
				discordId: table.translator.discordId,
				pages: table.translator.pages,
				tradCount: table.translator.tradCount,
				readCount: table.translator.readCount,
				userId: table.translator.userId
			})
			.from(table.translator)
			.orderBy(table.translator.name),
		db
			.select({
				id: table.user.id,
				username: table.user.username,
				email: table.user.email
			})
			.from(table.user)
			.orderBy(table.user.username)
	]);

	const translatorsWithPages = translator.map((translator) => ({
		...translator,
		pages: JSON.parse(translator.pages || '[]')
	}));

	return {
		translator: translatorsWithPages,
		users
	};
};

export const actions: Actions = {
	addTranslator: async ({ request }) => {
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

			const [created] = await db
				.insert(table.translator)
				.values({
					name,
					discordId: discordId || null,
					pages: JSON.stringify(pagesArray)
				})
				.returning({ id: table.translator.id });

			if (created && linkUserId) {
				await assignTranslatorUser(created.id, linkUserId);
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

	editTranslator: async ({ request }) => {
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
	}
};
