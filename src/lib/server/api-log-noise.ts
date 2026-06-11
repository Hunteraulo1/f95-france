/**
 * Erreurs HTTP attendues ou peu actionnables — on les garde dans `api_log`
 * mais on évite les alertes staff et le filtre « erreurs » des logs.
 */
export function isRoutineApiError(method: string, route: string, status: number): boolean {
	const m = method.toUpperCase();

	if (m === 'POST' && route === '/dashboard/manager/scrape' && status === 502) {
		return true;
	}

	if (m === 'DELETE' && status === 500 && route.startsWith('/dashboard/game/')) {
		return true;
	}

	return false;
}
