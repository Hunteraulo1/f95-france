/** Permission requise pour qu’un `edit_mode` soit actif sur un rôle. */
export const GAMES_MANAGE_PERMISSION = 'games.manage' as const;

/** Comment un rôle enregistre les jeux / traductions (ajout direct vs soumission). */
export type RoleEditMode = 'direct' | 'submission' | 'user_direct_mode';

export const ROLE_EDIT_MODE_OPTIONS: {
	value: RoleEditMode;
	label: string;
	description: string;
}[] = [
	{
		value: 'direct',
		label: 'Ajout direct',
		description: 'Les modifications sont appliquées immédiatement en base, sans file de soumission.'
	},
	{
		value: 'submission',
		label: 'Soumission',
		description: 'Chaque ajout ou modification crée une soumission en attente de validation.'
	},
	{
		value: 'user_direct_mode',
		label: 'Préférence utilisateur (mode direct)',
		description:
			'Possibilité pour les utilisateurs de choisir le mode direct dans leurs paramètres.'
	}
];

const VALID: ReadonlySet<string> = new Set(ROLE_EDIT_MODE_OPTIONS.map((o) => o.value));

export function isRoleEditMode(value: string): value is RoleEditMode {
	return VALID.has(value);
}

/** `edit_mode` effectif : `null` sans « Gestion des jeux » ou si la valeur en base est invalide. */
export function resolveEffectiveRoleEditMode(
	storedEditMode: string | null | undefined,
	hasGamesManage: boolean
): RoleEditMode | null {
	if (!hasGamesManage) return null;
	if (!storedEditMode || !isRoleEditMode(storedEditMode)) return null;
	return storedEditMode;
}

export function resolveShouldCreateSubmission(params: {
	roleEditMode: RoleEditMode;
	useDirectMode: boolean;
}): boolean {
	switch (params.roleEditMode) {
		case 'submission':
			return true;
		case 'direct':
			return false;
		case 'user_direct_mode':
			return !params.useDirectMode;
	}
}
