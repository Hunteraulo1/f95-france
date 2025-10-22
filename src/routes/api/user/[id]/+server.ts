import { getUserById } from '$lib/server/auth';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	// Vérifier que l'utilisateur est authentifié
	if (!locals.user) {
		return json({ error: 'Non authentifié' }, { status: 401 });
	}

	// Vérifier que l'utilisateur demande ses propres données
	if (locals.user.id !== params.id) {
		return json({ error: 'Accès non autorisé' }, { status: 403 });
	}

	try {
		const userData = await getUserById(params.id);
		
		if (!userData) {
			return json({ error: 'Utilisateur non trouvé' }, { status: 404 });
		}

		// Retourner les données utilisateur (sans le mot de passe)
		const { passwordHash, ...userWithoutPassword } = userData;
		return json(userWithoutPassword);
	} catch (error) {
		console.error('Erreur lors de la récupération des données utilisateur:', error);
		return json({ error: 'Erreur serveur' }, { status: 500 });
	}
};
