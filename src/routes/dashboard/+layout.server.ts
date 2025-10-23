import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	// Retourner les données utilisateur complètes pour le layout
	return {
		user: locals.user
	};
};
