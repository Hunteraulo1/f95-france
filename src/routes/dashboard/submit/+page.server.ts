import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	// Vérifier que l'utilisateur est authentifié
	if (!locals.user) {
		throw new Error('Non authentifié');
	}

	try {
		// Charger toutes les soumissions de l'utilisateur connecté
		const submissions = await db
			.select({
				id: table.submission.id,
				status: table.submission.status,
				type: table.submission.type,
				title: table.submission.title,
				description: table.submission.description,
				createdAt: table.submission.createdAt,
				updatedAt: table.submission.updatedAt,
				game: {
					id: table.game.id,
					name: table.game.name,
					image: table.game.image
				}
			})
			.from(table.submission)
			.leftJoin(table.game, eq(table.submission.gameId, table.game.id))
			.where(eq(table.submission.userId, locals.user.id))
			.orderBy(table.submission.createdAt);

		return {
			submissions: submissions.map(sub => ({
				...sub,
				description: sub.description || ''
			}))
		};
	} catch (error: unknown) {
		// Si la table n'existe pas encore, retourner une liste vide
		console.warn('Table submission n\'existe pas encore:', error);
		return {
			submissions: []
		};
	}
};
