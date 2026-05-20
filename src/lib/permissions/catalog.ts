/** Clés de permission stables (utilisées en base et dans le code). */
export const PERMISSION_KEYS = [
	'dashboard.view',
	'profile.view',
	'settings.view',
	'api_keys.own',
	'games.manage',
	'translations.own',
	'submissions.own',
	'submissions.review',
	'translators.manage',
	'users.manage',
	'users.assign_admin',
	'roles.manage',
	'api.management',
	'config.view',
	'config.edit',
	'logs.view',
	'dev.panel',
	'dev.impersonate',
	'maintenance.bypass'
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

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
		description: 'Voir et éditer son profil',
		group: 'Général'
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
		key: 'games.manage',
		label: 'Gestion des jeux',
		description: 'Ajouter et modifier les fiches jeux',
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
		key: 'users.manage',
		label: 'Utilisateurs',
		description: 'Lister et modifier les comptes utilisateurs',
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
		description: 'Modifier la configuration applicative',
		group: 'Système'
	},
	{
		key: 'logs.view',
		label: 'Logs API',
		description: 'Consulter les journaux d’API',
		group: 'Système'
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
		'games.manage',
		'translations.own',
		'submissions.own',
		'submissions.review',
		'translators.manage',
		'users.manage',
		'config.edit'
	],
	superadmin: PERMISSION_KEYS
};

export const SYSTEM_ROLE_LABELS: Record<string, string> = {
	user: 'Utilisateur',
	translator: 'Traducteur',
	admin: 'Administrateur',
	superadmin: 'Super administrateur'
};
