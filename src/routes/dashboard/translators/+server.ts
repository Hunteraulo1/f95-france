import { db } from '$lib/server/db';
import { translator } from '$lib/server/db/schema';
import { ensureTranslatorByName } from '$lib/server/ensure-translator';
import {
	assertDirectGameWriteAllowed,
	assertGameManageAccess,
	loadCurrentUserOrThrow
} from '$lib/server/game-manage-guard';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/** Ajout rapide depuis les formulaires jeu (mode direct admin). */
export const POST: RequestHandler = async ({ request, locals }) => {
	await assertGameManageAccess(locals);
	const currentUser = await loadCurrentUserOrThrow(locals.user!.id);
	await assertDirectGameWriteAllowed({
		roleSlug: currentUser.role,
		userDirectMode: currentUser.directMode ?? true,
		requestDirectMode: true
	});

	let body: { name?: unknown };
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Corps JSON invalide' }, { status: 400 });
	}

	const name = typeof body.name === 'string' ? body.name.trim() : '';
	if (!name) {
		return json({ error: 'Le nom est requis' }, { status: 400 });
	}

	try {
		const id = await ensureTranslatorByName(name);
		const rows = await db.select().from(translator);
		return json({ id, name, translators: rows });
	} catch (error: unknown) {
		console.error('Erreur création traducteur rapide:', error);
		const mysqlError =
			error && typeof error === 'object' && 'cause' in error
				? (error.cause as { code?: string; errno?: number })
				: null;
		if (mysqlError && (mysqlError.code === 'ER_DUP_ENTRY' || mysqlError.errno === 1062)) {
			return json({ error: `Un traducteur avec le nom « ${name} » existe déjà` }, { status: 409 });
		}
		return json({ error: 'Erreur lors de la création du traducteur' }, { status: 500 });
	}
};
