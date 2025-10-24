import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const translator = await db
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
		.orderBy(table.translator.name);

	const traductorsWithPages = translator.map(traductor => ({
		...traductor,
		pages: JSON.parse(traductor.pages || '[]')
	}));

	return {
		translator: traductorsWithPages
	};
};

export const actions: Actions = {
	addTranslator: async ({ request }) => {

		const formData = await request.formData();
		const name = formData.get('name') as string;
		const discordId = formData.get('discordId') as string;
		const pages = formData.get('pages') as string;

		if (!name) {
			return fail(400, { message: 'Le nom est requis' });
		}

		try {
			const pagesArray = pages ? JSON.parse(pages) : [];
			
			await db.insert(table.translator).values({
				name,
				discordId: discordId || null,
				pages: JSON.stringify(pagesArray)
			});

			return { success: true, message: 'Traducteur ajouté avec succès' };
		} catch (error) {
			console.error('Erreur lors de l\'ajout du traducteur:', error);
			return fail(500, { message: 'Erreur lors de l\'ajout du traducteur' });
		}
	},

	editTranslator: async ({ request }) => {

		const formData = await request.formData();
		const id = formData.get('id') as string;
		const name = formData.get('name') as string;
		const discordId = formData.get('discordId') as string;
		const pages = formData.get('pages') as string;

		if (!id || !name) {
			return fail(400, { message: 'ID et nom requis' });
		}

		try {
			const pagesArray = pages ? JSON.parse(pages) : [];
			
			await db
				.update(table.translator)
				.set({
					name,
					discordId: discordId || null,
					pages: JSON.stringify(pagesArray)
				})
				.where(eq(table.translator.id, id));

			return { success: true, message: 'Traducteur modifié avec succès' };
		} catch (error) {
			console.error('Erreur lors de la modification du traducteur:', error);
			return fail(500, { message: 'Erreur lors de la modification du traducteur' });
		}
	}
};
