import {
	assertDirectGameWriteAllowed,
	loadCurrentUserOrThrow
} from '$lib/server/game-manage-guard';
import { assertPermission } from '$lib/server/permissions';
import {
	revertUpdateHistoryEntry,
	UpdateHistoryRevertError
} from '$lib/server/revert-update-history';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const REVERT_HISTORY_MESSAGE =
	'Accès réservé — permission « Restaurer depuis l’historique » requise';

export const POST: RequestHandler = async ({ params, locals }) => {
	await assertPermission(locals, 'games.revert_history', REVERT_HISTORY_MESSAGE);

	const user = locals.user;
	if (!user) {
		return json({ error: 'Non authentifié' }, { status: 401 });
	}

	const { id: gameId, historyId } = params;
	if (!gameId || !historyId) {
		return json({ error: 'Identifiants requis' }, { status: 400 });
	}

	await loadCurrentUserOrThrow(user.id);
	await assertDirectGameWriteAllowed({
		roleSlug: user.role ?? 'user',
		userDirectMode: user.directMode ?? true
	});

	try {
		const result = await revertUpdateHistoryEntry(gameId, historyId, user.id);
		return json({ success: true, ...result });
	} catch (err) {
		if (err instanceof UpdateHistoryRevertError) {
			return json({ error: err.message }, { status: err.status });
		}
		console.error('[update-history] revert failed:', err);
		return json({ error: 'Erreur serveur' }, { status: 500 });
	}
};
