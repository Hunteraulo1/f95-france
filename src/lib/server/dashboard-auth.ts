import { redirect } from '@sveltejs/kit';

const DASHBOARD_PUBLIC_EXACT = new Set([
	'/dashboard/login',
	'/dashboard/register',
	'/dashboard/logout'
]);

/** Profil public canonique (`/profile/{pseudo}`). */
export function isPublicProfilePath(pathname: string): boolean {
	return pathname.startsWith('/profile/') && pathname !== '/profile';
}

/** Routes dashboard accessibles sans session (auth, déconnexion, redirections profil). */
export function isPublicDashboardPath(pathname: string): boolean {
	if (DASHBOARD_PUBLIC_EXACT.has(pathname)) {
		return true;
	}
	if (pathname.startsWith('/dashboard/profile/') && pathname !== '/dashboard/profile') {
		return true;
	}
	return false;
}

/** Catalogue jeux public. */
export function isPublicGamesPath(pathname: string): boolean {
	return pathname === '/games' || pathname.startsWith('/games/');
}

/** Pages accessibles sans connexion (hors assets). */
export function isPublicSitePath(pathname: string): boolean {
	return (
		isPublicProfilePath(pathname) || isPublicDashboardPath(pathname) || isPublicGamesPath(pathname)
	);
}

/** Redirige vers la page de connexion si la session est absente (pages dashboard protégées). */
export function assertDashboardAuthenticated(
	locals: App.Locals
): asserts locals is App.Locals & { user: NonNullable<App.Locals['user']> } {
	if (!locals.user) {
		redirect(303, '/dashboard/login');
	}
}

/** Redirection interne sûre après connexion (évite les open redirects). */
export function safeDashboardRedirectPath(candidate: string | null | undefined): string {
	const raw = (candidate ?? '').trim();
	if (!raw.startsWith('/dashboard') || raw.startsWith('//')) {
		return '/dashboard';
	}
	return raw;
}
