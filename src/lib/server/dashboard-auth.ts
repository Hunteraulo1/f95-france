const DASHBOARD_PUBLIC_EXACT = new Set([
	'/dashboard/login',
	'/dashboard/register',
	'/dashboard/logout'
]);

/** Routes dashboard accessibles sans session (auth, déconnexion, profils publics). */
export function isPublicDashboardPath(pathname: string): boolean {
	if (DASHBOARD_PUBLIC_EXACT.has(pathname)) {
		return true;
	}
	if (pathname.startsWith('/dashboard/profile/') && pathname !== '/dashboard/profile') {
		return true;
	}
	return false;
}

/** Redirection interne sûre après connexion (évite les open redirects). */
export function safeDashboardRedirectPath(candidate: string | null | undefined): string {
	const raw = (candidate ?? '').trim();
	if (!raw.startsWith('/dashboard') || raw.startsWith('//')) {
		return '/dashboard';
	}
	return raw;
}
