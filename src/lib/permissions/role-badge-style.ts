/** Style d’affichage (badge / pseudo) pour un rôle. */
export type RoleBadgeStyle =
	| 'default'
	| 'primary'
	| 'secondary'
	| 'accent'
	| 'info'
	| 'success'
	| 'warning'
	| 'error'
	| 'neutral'
	| 'superadmin';

export const ROLE_BADGE_STYLE_OPTIONS: {
	value: RoleBadgeStyle;
	label: string;
	description: string;
}[] = [
	{
		value: 'default',
		label: 'Par défaut',
		description: 'Texte et badge standard, sans couleur de rôle.'
	},
	{
		value: 'primary',
		label: 'Primaire',
		description: 'Couleur principale du thème.'
	},
	{
		value: 'secondary',
		label: 'Secondaire',
		description: 'Couleur secondaire du thème.'
	},
	{
		value: 'accent',
		label: 'Accent',
		description: 'Couleur d’accent du thème.'
	},
	{
		value: 'info',
		label: 'Info',
		description: 'Bleu informatif.'
	},
	{
		value: 'success',
		label: 'Succès',
		description: 'Vert « succès ».'
	},
	{
		value: 'warning',
		label: 'Avertissement',
		description: 'Jaune / ambre d’avertissement.'
	},
	{
		value: 'error',
		label: 'Erreur',
		description: 'Rouge « danger ».'
	},
	{
		value: 'neutral',
		label: 'Neutre',
		description: 'Gris neutre du thème.'
	},
	{
		value: 'superadmin',
		label: 'Superadmin (animé)',
		description: 'Dégradé animé primaire / secondaire / accent.'
	}
];

const VALID = new Set(ROLE_BADGE_STYLE_OPTIONS.map((o) => o.value));

export function isRoleBadgeStyle(value: string): value is RoleBadgeStyle {
	return VALID.has(value as RoleBadgeStyle);
}

/** Styles par défaut des rôles système (migration / seed). */
export const SYSTEM_ROLE_BADGE_STYLES: Record<string, RoleBadgeStyle> = {
	user: 'default',
	translator: 'secondary',
	admin: 'primary',
	superadmin: 'superadmin'
};

export function resolveRoleBadgeStyle(
	slug: string,
	stored: string | null | undefined
): RoleBadgeStyle {
	if (stored && isRoleBadgeStyle(stored)) return stored;
	return SYSTEM_ROLE_BADGE_STYLES[slug] ?? 'default';
}
