import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ url, locals }) => {
	// Vérifier si on est sur une page qui nécessite une authentification
	const protectedPaths = ['/dashboard'];
	const isProtectedPath = protectedPaths.some(path => url.pathname.startsWith(path));
	
	// Vérifier si on est sur une page d'authentification
	const authPaths = ['/dashboard/login', '/dashboard/register'];
	const isAuthPath = authPaths.includes(url.pathname);
	
	// Si on est sur une page protégée et pas connecté, rediriger vers login
	if (isProtectedPath && !locals.user && !isAuthPath) {
		throw redirect(302, '/dashboard/login');
	}
	
	// Si on est sur une page d'auth et déjà connecté, rediriger vers dashboard
	if (isAuthPath && locals.user) {
		throw redirect(302, '/dashboard');
	}
	
	return {
		user: locals.user
	};
};
