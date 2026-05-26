import { getUserById } from '$lib/server/auth';
import type { User } from '$lib/server/db/schema';
import { assertPermission } from '$lib/server/permissions-guard';
import { getRoleEditMode, resolveShouldCreateSubmissionForUser } from '$lib/server/role-edit-mode';
import { error } from '@sveltejs/kit';

const GAME_MANAGE_MESSAGE = 'Accès réservé — permission « Gestion des jeux » requise';
const DIRECT_WRITE_FORBIDDEN_MESSAGE =
	'Votre rôle ne permet pas l’ajout ou la modification directe en base. Utilisez une soumission.';

/** Permission `games.manage` (vérifiée en base / locals, pas côté client). */
export async function assertGameManageAccess(locals: App.Locals): Promise<void> {
	await assertPermission(locals, 'games.manage', GAME_MANAGE_MESSAGE);
}

export type GameWriteModeParams = {
	roleSlug: string;
	userDirectMode: boolean;
	requestDirectMode?: boolean;
};

/** Détermine si l’écriture doit passer par une soumission (autorité serveur). */
export async function resolveGameWriteMode(
	params: GameWriteModeParams
): Promise<'submission' | 'direct'> {
	const shouldCreateSubmission = await resolveShouldCreateSubmissionForUser(params);
	return shouldCreateSubmission ? 'submission' : 'direct';
}

/** Interdit l’écriture directe si le rôle impose les soumissions (ex. traducteur). */
export async function assertDirectGameWriteAllowed(params: GameWriteModeParams): Promise<void> {
	const roleEditMode = await getRoleEditMode(params.roleSlug);
	if (roleEditMode === 'submission') {
		error(403, DIRECT_WRITE_FORBIDDEN_MESSAGE);
	}

	const mode = await resolveGameWriteMode(params);
	if (mode === 'submission') {
		error(403, DIRECT_WRITE_FORBIDDEN_MESSAGE);
	}
}

export async function loadCurrentUserOrThrow(userId: string): Promise<User> {
	const user = await getUserById(userId);
	if (!user) {
		error(404, 'Utilisateur non trouvé');
	}
	return user;
}

export function parseRequestDirectMode(directMode: unknown): boolean | undefined {
	if (typeof directMode === 'boolean') return directMode;
	if (directMode === 'true' || directMode === 1) return true;
	if (directMode === 'false' || directMode === 0) return false;
	return undefined;
}
