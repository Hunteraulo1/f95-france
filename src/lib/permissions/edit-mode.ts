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
			'Chaque compte choisit via le toggle « Mode direct » dans ses paramètres (comme les superadmins aujourd’hui).'
	}
];

const VALID: ReadonlySet<string> = new Set(ROLE_EDIT_MODE_OPTIONS.map((o) => o.value));

export function isRoleEditMode(value: string): value is RoleEditMode {
	return VALID.has(value);
}

/** Valeurs par défaut des rôles système (repli si colonne absente ou rôle inconnu). */
export function legacyEditModeForRoleSlug(slug: string): RoleEditMode {
	if (slug === 'translator') return 'submission';
	if (slug === 'superadmin') return 'user_direct_mode';
	if (slug === 'admin') return 'direct';
	return 'direct';
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
