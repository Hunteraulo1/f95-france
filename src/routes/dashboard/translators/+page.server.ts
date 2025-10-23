import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	// Récupérer tous les traducteurs avec leurs pages
	const traductors = await db
		.select({
			id: table.traductors.id,
			name: table.traductors.name,
			discordId: table.traductors.discordId,
			pages: table.traductors.pages,
			tradCount: table.traductors.tradCount,
			readCount: table.traductors.readCount
		})
		.from(table.traductors)
		.orderBy(table.traductors.name);

	// Parser les pages JSON pour chaque traducteur
	const traductorsWithPages = traductors.map(traductor => ({
		...traductor,
		pages: JSON.parse(traductor.pages || '[]')
	}));

	return {
		traductors: traductorsWithPages
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
			// Valider le JSON des pages
			const pagesArray = pages ? JSON.parse(pages) : [];
			
			await db.insert(table.traductors).values({
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
			// Valider le JSON des pages
			const pagesArray = pages ? JSON.parse(pages) : [];
			
			await db
				.update(table.traductors)
				.set({
					name,
					discordId: discordId || null,
					pages: JSON.stringify(pagesArray)
				})
				.where(eq(table.traductors.id, id));

			return { success: true, message: 'Traducteur modifié avec succès' };
		} catch (error) {
			console.error('Erreur lors de la modification du traducteur:', error);
			return fail(500, { message: 'Erreur lors de la modification du traducteur' });
		}
	}
};
