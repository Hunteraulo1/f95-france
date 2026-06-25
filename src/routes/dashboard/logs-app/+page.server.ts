import { loadDashboardAppLogsPage } from '$lib/server/dashboard-app-logs-page-load';
import { assertPermission } from '$lib/server/permissions';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	await assertPermission(locals, 'logs.view', 'Accès refusé');

	try {
		return await loadDashboardAppLogsPage(url, 1);
	} catch (err) {
		console.error('Erreur lors du chargement des logs applicatifs:', err);
		throw error(
			500,
			`Erreur lors du chargement des logs applicatifs: ${err instanceof Error ? err.message : String(err)}`
		);
	}
};
