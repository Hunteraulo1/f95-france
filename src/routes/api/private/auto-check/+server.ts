import { runAutoCheckVersions } from '$lib/server/check-version';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

/** Session ou clé API : le compte effectif doit être superadmin (propriétaire de la clé). */
function canTriggerAutoCheck(locals: App.Locals): boolean {
	return locals.user?.role === 'superadmin';
}

/** Déclenche l’auto-check des versions (même logique que le cron / le bouton dev). */
export const POST: RequestHandler = async ({ locals }) => {
	if (!canTriggerAutoCheck(locals)) {
		return json(
			{
				error:
					'Accès refusé : réservé aux superadmins (session) ou à une clé API dont le propriétaire est superadmin.'
			},
			{ status: 403 }
		);
	}

	try {
		const result = await runAutoCheckVersions();
		const now = new Date();
		await db
			.update(table.config)
			.set({ autoCheckLastRunAt: now, updatedAt: now })
			.where(eq(table.config.id, 'main'));

		return json({ ok: true, ...result });
	} catch (err) {
		console.error('[api/private/auto-check] erreur:', err);
		return json(
			{ ok: false, error: "Échec de l'auto-check." },
			{ status: 500 }
		);
	}
};
