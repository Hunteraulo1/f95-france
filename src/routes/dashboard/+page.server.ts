import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	// Vérifier que l'utilisateur est connecté
	if (!locals.user) {
		throw redirect(302, '/dashboard/login');
	}

	// Retourner les données utilisateur complètes
	return {
		user: locals.user
	};
};
