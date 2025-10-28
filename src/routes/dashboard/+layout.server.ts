import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	// Retourner les données utilisateur complètes pour le layout
	console.log('🔍 Layout Server - locals.user:', locals.user ? {
		id: locals.user.id,
		username: locals.user.username,
		email: locals.user.email
	} : 'null');
	
	return {
		user: locals.user
	};
};
