import type { RoleEditMode } from './edit-mode';

/** Clés de permission stables (utilisées en base et dans le code). */
export const PERMISSION_KEYS = [
	'dashboard.view',
	'profile.view',
	'profile.customize.bio',
	'profile.customize.background',
	'profile.customize.music',
	'profile.customize.cursor',
	'settings.view',
	'api_keys.own',
	'api_keys.label_brackets',
	'games.manage',
	'games.auto_check',
	'auto_check.monitor',
	'games.silent_mode',
	'games.view_history',
	'games.revert_history',
	'translations.own',
	'submissions.own',
	'submissions.review',
	'translators.manage',
	'translator_applications.review',
	'users.manage',
	'users.view_email',
	'users.assign_admin',
	'roles.manage',
	'api.management',
	'config.view',
	'config.edit',
	'maintenance.manage',
	'logs.view',
	'content.view_ids',
	'dev.panel',
	'dev.impersonate',
	'maintenance.bypass'
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export const SUPERADMIN_ROLE_SLUG = 'superadmin' as const;

export function isSuperadminRole(roleSlug: string | null | undefined): boolean {
	return roleSlug === SUPERADMIN_ROLE_SLUG;
}

export type PermissionDefinition = {
	key: PermissionKey;
	label: string;
	description: string;
	group: string;
};

export const PERMISSION_CATALOG: PermissionDefinition[] = [
	{
		key: 'dashboard.view',
		label: 'Tableau de bord',
		description: 'Accès à la page d’accueil du dashboard',
		group: 'Général'
	},
	{
		key: 'profile.view',
		label: 'Profil',
		description: 'Voir son profil et ceux des autres membres',
		group: 'Général'
	},
	{
		key: 'profile.customize.bio',
		label: 'Bio',
		description: 'Modifier la bio affichée sur le profil public',
		group: 'Profil personnalisé'
	},
	{
		key: 'profile.customize.background',
		label: 'Image de fond',
		description: 'Modifier l’image de fond du profil public',
		group: 'Profil personnalisé'
	},
	{
		key: 'profile.customize.music',
		label: 'Musique',
		description: 'Ajouter une musique YouTube / YouTube Music sur le profil public',
		group: 'Profil personnalisé'
	},
	{
		key: 'profile.customize.cursor',
		label: 'Curseur',
		description: 'Personnaliser le curseur affiché sur le profil public',
		group: 'Profil personnalisé'
	},
	{
		key: 'settings.view',
		label: 'Paramètres',
		description: 'Paramètres personnels du compte',
		group: 'Général'
	},
	{
		key: 'api_keys.own',
		label: 'Mes clés API',
		description: 'Gérer ses propres clés API',
		group: 'Général'
	},
	{
		key: 'api_keys.label_brackets',
		label: 'Libellés avec crochets',
		description:
			'Utiliser des crochets [ ] dans le libellé d’une clé API (ex. [extension-only] pour restreindre une clé à /api/extension-api)',
		group: 'Général'
	},
	{
		key: 'games.manage',
		label: 'Gestion des jeux',
		description: 'Ajouter et modifier les fiches jeux',
		group: 'Contenu'
	},
	{
		key: 'games.auto_check',
		label: 'Auto-check (jeu et traductions)',
		description:
			'Activer ou désactiver l’auto-check sur les fiches F95, modifier l’auto-check des traductions et actualiser la version d’un jeu via le checker',
		group: 'Contenu'
	},
	{
		key: 'auto_check.monitor',
		label: 'Suivi auto-check',
		description:
			'Consulter l’historique des exécutions du cron auto-check et lancer un auto-check manuel',
		group: 'Contenu'
	},
	{
		key: 'games.silent_mode',
		label: 'Mode silencieux',
		description:
			'Ajouter ou modifier des traductions sans envoyer de notification Discord (mode silencieux)',
		group: 'Contenu'
	},
	{
		key: 'games.view_history',
		label: 'Historique des traductions',
		description: 'Consulter l’historique des changements sur les traductions d’un jeu',
		group: 'Contenu'
	},
	{
		key: 'games.revert_history',
		label: 'Restaurer depuis l’historique',
		description:
			'Restaurer un état antérieur des traductions à partir de l’historique (y compris plusieurs modifications d’un coup)',
		group: 'Contenu'
	},
	{
		key: 'translations.own',
		label: 'Mes traductions',
		description: 'Voir et gérer ses traductions liées au profil traducteur',
		group: 'Contenu'
	},
	{
		key: 'submissions.own',
		label: 'Mes soumissions',
		description: 'Créer et suivre ses propres soumissions',
		group: 'Contenu'
	},
	{
		key: 'submissions.review',
		label: 'Modération des soumissions',
		description: 'Valider ou refuser les soumissions des traducteurs',
		group: 'Modération'
	},
	{
		key: 'translators.manage',
		label: 'Traducteurs / relecteurs',
		description: 'Gérer les profils traducteurs',
		group: 'Modération'
	},
	{
		key: 'translator_applications.review',
		label: 'Candidatures traducteur',
		description: 'Valider ou refuser les demandes pour devenir traducteur',
		group: 'Modération'
	},
	{
		key: 'users.manage',
		label: 'Utilisateurs',
		description: 'Lister et modifier les comptes utilisateurs',
		group: 'Administration'
	},
	{
		key: 'users.view_email',
		label: 'Emails des utilisateurs',
		description: 'Voir les adresses email des comptes utilisateurs',
		group: 'Administration'
	},
	{
		key: 'users.assign_admin',
		label: 'Attribuer admin / superadmin',
		description: 'Promouvoir un compte au rôle administrateur ou superadmin',
		group: 'Administration'
	},
	{
		key: 'roles.manage',
		label: 'Rôles et permissions',
		description: 'Créer des rôles personnalisés et modifier leurs droits',
		group: 'Administration'
	},
	{
		key: 'api.management',
		label: 'Gestion API globale',
		description: 'Administration des clés et quotas API',
		group: 'Système'
	},
	{
		key: 'config.view',
		label: 'Configuration (lecture)',
		description: 'Voir la configuration applicative',
		group: 'Système'
	},
	{
		key: 'config.edit',
		label: 'Configuration (écriture)',
		description: 'Modifier le nom de l’application, Google Sheets et OAuth (hors mode maintenance)',
		group: 'Système'
	},
	{
		key: 'maintenance.manage',
		label: 'Activer la maintenance',
		description: 'Activer ou désactiver le mode maintenance du site',
		group: 'Système'
	},
	{
		key: 'logs.view',
		label: 'Logs API',
		description: 'Consulter les journaux d’API',
		group: 'Système'
	},
	{
		key: 'content.view_ids',
		label: 'Identifiants internes',
		description: 'Afficher et copier les UUID (jeux, traductions, soumissions)',
		group: 'Modération'
	},
	{
		key: 'dev.panel',
		label: 'Panel développeur',
		description: 'Outils de développement internes',
		group: 'Système'
	},
	{
		key: 'dev.impersonate',
		label: "Changer d'utilisateur (Dev)",
		description: 'Basculer la session vers un autre compte utilisateur (mode développeur)',
		group: 'Système'
	},
	{
		key: 'maintenance.bypass',
		label: 'Contourner la maintenance',
		description: 'Accéder au site pendant le mode maintenance',
		group: 'Système'
	}
];

/** Droits par rôle système (équivalent à l’ancien comportement codé en dur). */
export const SYSTEM_ROLE_PERMISSIONS: Record<string, readonly PermissionKey[]> = {
	user: ['dashboard.view', 'profile.view', 'settings.view', 'api_keys.own'],
	translator: [
		'dashboard.view',
		'profile.view',
		'settings.view',
		'api_keys.own',
		'games.manage',
		'translations.own',
		'submissions.own'
	],
	admin: [
		'dashboard.view',
		'profile.view',
		'settings.view',
		'api_keys.own',
		'api_keys.label_brackets',
		'games.manage',
		'games.auto_check',
		'auto_check.monitor',
		'games.silent_mode',
		'games.view_history',
		'games.revert_history',
		'translations.own',
		'submissions.own',
		'submissions.review',
		'translators.manage',
		'translator_applications.review',
		'users.manage',
		'users.view_email',
		'config.edit',
		'content.view_ids'
	],
	superadmin: PERMISSION_KEYS
};

/** `edit_mode` initial des rôles système (seed / migration `0018_role_edit_mode`). */
export const SYSTEM_ROLE_EDIT_MODES: Record<keyof typeof SYSTEM_ROLE_PERMISSIONS, RoleEditMode> = {
	user: 'direct',
	translator: 'submission',
	admin: 'direct',
	superadmin: 'user_direct_mode'
};

export const SYSTEM_ROLE_LABELS: Record<string, string> = {
	user: 'Utilisateur',
	translator: 'Traducteur',
	admin: 'Administrateur',
	superadmin: 'Super administrateur'
};

export function permissionCatalogGrouped(): Map<string, typeof PERMISSION_CATALOG> {
	const groups = new Map<string, typeof PERMISSION_CATALOG>();
	for (const def of PERMISSION_CATALOG) {
		const list = groups.get(def.group) ?? [];
		list.push(def);
		groups.set(def.group, list);
	}
	return groups;
}
