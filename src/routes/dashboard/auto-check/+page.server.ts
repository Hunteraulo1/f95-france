import { toConfigClientSafe } from '$lib/server/app-config';
import { loadAutoCheckRunsPage } from '$lib/server/auto-check-runs-page-load';
import { runAutoCheckVersions } from '$lib/server/check-version';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { assertPermission } from '$lib/server/permissions';
import { eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

export const config = {
	maxDuration: 300
};

export const load: PageServerLoad = async ({ locals, url }) => {
	await assertPermission(locals, 'auto_check.monitor');

	const selectedRunId = url.searchParams.get('run');

	try {
		const [pageData, configRows] = await Promise.all([
			loadAutoCheckRunsPage(selectedRunId),
			db.select().from(table.config).where(eq(table.config.id, 'main')).limit(1)
		]);

		return {
			...pageData,
			config: configRows[0] ? toConfigClientSafe(configRows[0]) : null
		};
	} catch (error) {
		console.warn('Erreur chargement suivi auto-check (migration auto_check_run ?):', error);
		return {
			runs: [],
			selectedRunId: null,
			items: [],
			config: null
		};
	}
};

export const actions: Actions = {
	triggerAutoCheck: async ({ locals }) => {
		await assertPermission(locals, 'auto_check.monitor');

		try {
			const result = await runAutoCheckVersions({
				refreshWebhookUrls: true,
				logSource: 'worker',
				triggerSource: 'manual'
			});
			await db
				.update(table.config)
				.set({
					autoCheckLastRunAt: new Date(),
					updatedAt: new Date()
				})
				.where(eq(table.config.id, 'main'));

			return {
				success: true,
				message: `Auto-check : ${result.updatedGames} jeu(x) mis à jour, ${result.disabledAlignedGames} déjà aligné(s), ${result.translatorDmsSent} MP traducteur(s), ${result.translatorWebhooksSent} webhook(s) traducteur(s)`,
				details: result
			};
		} catch (error: unknown) {
			return {
				success: false,
				message: "Erreur lors de l'exécution de l'auto-check",
				details: error instanceof Error ? error.message : 'Erreur inconnue'
			};
		}
	}
};
