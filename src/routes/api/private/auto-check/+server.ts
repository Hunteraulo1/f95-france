import { logApp } from '$lib/server/app-logger';
import { runAutoCheckVersions } from '$lib/server/check-version';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { hasPermission } from '$lib/server/permissions';
import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

/** Session ou clé API : permission `games.auto_check`. */
function canTriggerAutoCheck(locals: App.Locals): boolean {
	return hasPermission(locals, 'games.auto_check');
}

/** Déclenche l’auto-check des versions (même logique que le cron / le bouton dev). */
export const POST: RequestHandler = async ({ locals }) => {
	if (!canTriggerAutoCheck(locals)) {
		return json(
			{
				error:
					'Accès refusé : permission « Suivi auto-check » requise (session ou propriétaire de la clé API).'
			},
			{ status: 403 }
		);
	}

	try {
		const result = await runAutoCheckVersions({ logSource: 'worker' });
		const now = new Date();
		await db
			.update(table.config)
			.set({ autoCheckLastRunAt: now, updatedAt: now })
			.where(eq(table.config.id, 'main'));

		return json({ ok: true, ...result });
	} catch (err) {
		logApp({
			level: 'error',
			source: 'worker',
			message: 'auto-check API : échec',
			meta: { detail: err instanceof Error ? err.message : String(err) }
		});
		return json({ ok: false, error: "Échec de l'auto-check." }, { status: 500 });
	}
};
