CREATE TABLE "app_permission" (
	"key" varchar(64) PRIMARY KEY NOT NULL,
	"label" varchar(255) NOT NULL,
	"description" text,
	"group" varchar(64)
);
--> statement-breakpoint
CREATE TABLE "app_role" (
	"slug" varchar(64) PRIMARY KEY NOT NULL,
	"label" varchar(255) NOT NULL,
	"description" text,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_role_permission" (
	"role_slug" varchar(64) NOT NULL,
	"permission_key" varchar(64) NOT NULL,
	CONSTRAINT "app_role_permission_role_slug_permission_key_pk" PRIMARY KEY("role_slug","permission_key")
);
--> statement-breakpoint
ALTER TABLE "app_role_permission" ADD CONSTRAINT "app_role_permission_role_slug_app_role_slug_fk" FOREIGN KEY ("role_slug") REFERENCES "public"."app_role"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_role_permission" ADD CONSTRAINT "app_role_permission_permission_key_app_permission_key_fk" FOREIGN KEY ("permission_key") REFERENCES "public"."app_permission"("key") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
-- seed RBAC
INSERT INTO app_permission (key, label, description, "group") VALUES ('dashboard.view', 'Tableau de bord', 'Accès à la page d’accueil du dashboard', 'Général') ON CONFLICT (key) DO NOTHING;
INSERT INTO app_permission (key, label, description, "group") VALUES ('profile.view', 'Profil', 'Voir et éditer son profil', 'Général') ON CONFLICT (key) DO NOTHING;
INSERT INTO app_permission (key, label, description, "group") VALUES ('settings.view', 'Paramètres', 'Paramètres personnels du compte', 'Général') ON CONFLICT (key) DO NOTHING;
INSERT INTO app_permission (key, label, description, "group") VALUES ('api_keys.own', 'Mes clés API', 'Gérer ses propres clés API', 'Général') ON CONFLICT (key) DO NOTHING;
INSERT INTO app_permission (key, label, description, "group") VALUES ('games.manage', 'Gestion des jeux', 'Ajouter et modifier les fiches jeux', 'Contenu') ON CONFLICT (key) DO NOTHING;
INSERT INTO app_permission (key, label, description, "group") VALUES ('translations.own', 'Mes traductions', 'Voir et gérer ses traductions liées au profil traducteur', 'Contenu') ON CONFLICT (key) DO NOTHING;
INSERT INTO app_permission (key, label, description, "group") VALUES ('submissions.own', 'Mes soumissions', 'Créer et suivre ses propres soumissions', 'Contenu') ON CONFLICT (key) DO NOTHING;
INSERT INTO app_permission (key, label, description, "group") VALUES ('submissions.review', 'Modération des soumissions', 'Valider ou refuser les soumissions des traducteurs', 'Modération') ON CONFLICT (key) DO NOTHING;
INSERT INTO app_permission (key, label, description, "group") VALUES ('translators.manage', 'Traducteurs / relecteurs', 'Gérer les profils traducteurs', 'Modération') ON CONFLICT (key) DO NOTHING;
INSERT INTO app_permission (key, label, description, "group") VALUES ('users.manage', 'Utilisateurs', 'Lister et modifier les comptes utilisateurs', 'Administration') ON CONFLICT (key) DO NOTHING;
INSERT INTO app_permission (key, label, description, "group") VALUES ('users.assign_admin', 'Attribuer admin / superadmin', 'Promouvoir un compte au rôle administrateur ou superadmin', 'Administration') ON CONFLICT (key) DO NOTHING;
INSERT INTO app_permission (key, label, description, "group") VALUES ('roles.manage', 'Rôles et permissions', 'Créer des rôles personnalisés et modifier leurs droits', 'Administration') ON CONFLICT (key) DO NOTHING;
INSERT INTO app_permission (key, label, description, "group") VALUES ('api.management', 'Gestion API globale', 'Administration des clés et quotas API', 'Système') ON CONFLICT (key) DO NOTHING;
INSERT INTO app_permission (key, label, description, "group") VALUES ('config.view', 'Configuration (lecture)', 'Voir la configuration applicative', 'Système') ON CONFLICT (key) DO NOTHING;
INSERT INTO app_permission (key, label, description, "group") VALUES ('config.edit', 'Configuration (écriture)', 'Modifier la configuration applicative', 'Système') ON CONFLICT (key) DO NOTHING;
INSERT INTO app_permission (key, label, description, "group") VALUES ('logs.view', 'Logs API', 'Consulter les journaux d’API', 'Système') ON CONFLICT (key) DO NOTHING;
INSERT INTO app_permission (key, label, description, "group") VALUES ('dev.panel', 'Panel développeur', 'Outils de développement internes', 'Système') ON CONFLICT (key) DO NOTHING;
INSERT INTO app_permission (key, label, description, "group") VALUES ('maintenance.bypass', 'Contourner la maintenance', 'Accéder au site pendant le mode maintenance', 'Système') ON CONFLICT (key) DO NOTHING;
INSERT INTO app_role (slug, label, is_system) VALUES ('user', 'Utilisateur', true) ON CONFLICT (slug) DO NOTHING;
INSERT INTO app_role (slug, label, is_system) VALUES ('translator', 'Traducteur', true) ON CONFLICT (slug) DO NOTHING;
INSERT INTO app_role (slug, label, is_system) VALUES ('admin', 'Administrateur', true) ON CONFLICT (slug) DO NOTHING;
INSERT INTO app_role (slug, label, is_system) VALUES ('superadmin', 'Super administrateur', true) ON CONFLICT (slug) DO NOTHING;
INSERT INTO app_role_permission (role_slug, permission_key) VALUES ('user', 'dashboard.view') ON CONFLICT DO NOTHING;
INSERT INTO app_role_permission (role_slug, permission_key) VALUES ('user', 'profile.view') ON CONFLICT DO NOTHING;
INSERT INTO app_role_permission (role_slug, permission_key) VALUES ('user', 'settings.view') ON CONFLICT DO NOTHING;
INSERT INTO app_role_permission (role_slug, permission_key) VALUES ('user', 'api_keys.own') ON CONFLICT DO NOTHING;
INSERT INTO app_role_permission (role_slug, permission_key) VALUES ('translator', 'dashboard.view') ON CONFLICT DO NOTHING;
INSERT INTO app_role_permission (role_slug, permission_key) VALUES ('translator', 'profile.view') ON CONFLICT DO NOTHING;
INSERT INTO app_role_permission (role_slug, permission_key) VALUES ('translator', 'settings.view') ON CONFLICT DO NOTHING;
INSERT INTO app_role_permission (role_slug, permission_key) VALUES ('translator', 'api_keys.own') ON CONFLICT DO NOTHING;
INSERT INTO app_role_permission (role_slug, permission_key) VALUES ('translator', 'games.manage') ON CONFLICT DO NOTHING;
INSERT INTO app_role_permission (role_slug, permission_key) VALUES ('translator', 'translations.own') ON CONFLICT DO NOTHING;
INSERT INTO app_role_permission (role_slug, permission_key) VALUES ('translator', 'submissions.own') ON CONFLICT DO NOTHING;
INSERT INTO app_role_permission (role_slug, permission_key) VALUES ('admin', 'dashboard.view') ON CONFLICT DO NOTHING;
INSERT INTO app_role_permission (role_slug, permission_key) VALUES ('admin', 'profile.view') ON CONFLICT DO NOTHING;
INSERT INTO app_role_permission (role_slug, permission_key) VALUES ('admin', 'settings.view') ON CONFLICT DO NOTHING;
INSERT INTO app_role_permission (role_slug, permission_key) VALUES ('admin', 'api_keys.own') ON CONFLICT DO NOTHING;
INSERT INTO app_role_permission (role_slug, permission_key) VALUES ('admin', 'games.manage') ON CONFLICT DO NOTHING;
INSERT INTO app_role_permission (role_slug, permission_key) VALUES ('admin', 'translations.own') ON CONFLICT DO NOTHING;
INSERT INTO app_role_permission (role_slug, permission_key) VALUES ('admin', 'submissions.own') ON CONFLICT DO NOTHING;
INSERT INTO app_role_permission (role_slug, permission_key) VALUES ('admin', 'submissions.review') ON CONFLICT DO NOTHING;
INSERT INTO app_role_permission (role_slug, permission_key) VALUES ('admin', 'translators.manage') ON CONFLICT DO NOTHING;
INSERT INTO app_role_permission (role_slug, permission_key) VALUES ('admin', 'users.manage') ON CONFLICT DO NOTHING;
INSERT INTO app_role_permission (role_slug, permission_key) VALUES ('admin', 'config.edit') ON CONFLICT DO NOTHING;
INSERT INTO app_role_permission (role_slug, permission_key) VALUES ('superadmin', 'dashboard.view') ON CONFLICT DO NOTHING;
INSERT INTO app_role_permission (role_slug, permission_key) VALUES ('superadmin', 'profile.view') ON CONFLICT DO NOTHING;
INSERT INTO app_role_permission (role_slug, permission_key) VALUES ('superadmin', 'settings.view') ON CONFLICT DO NOTHING;
INSERT INTO app_role_permission (role_slug, permission_key) VALUES ('superadmin', 'api_keys.own') ON CONFLICT DO NOTHING;
INSERT INTO app_role_permission (role_slug, permission_key) VALUES ('superadmin', 'games.manage') ON CONFLICT DO NOTHING;
INSERT INTO app_role_permission (role_slug, permission_key) VALUES ('superadmin', 'translations.own') ON CONFLICT DO NOTHING;
INSERT INTO app_role_permission (role_slug, permission_key) VALUES ('superadmin', 'submissions.own') ON CONFLICT DO NOTHING;
INSERT INTO app_role_permission (role_slug, permission_key) VALUES ('superadmin', 'submissions.review') ON CONFLICT DO NOTHING;
INSERT INTO app_role_permission (role_slug, permission_key) VALUES ('superadmin', 'translators.manage') ON CONFLICT DO NOTHING;
INSERT INTO app_role_permission (role_slug, permission_key) VALUES ('superadmin', 'users.manage') ON CONFLICT DO NOTHING;
INSERT INTO app_role_permission (role_slug, permission_key) VALUES ('superadmin', 'users.assign_admin') ON CONFLICT DO NOTHING;
INSERT INTO app_role_permission (role_slug, permission_key) VALUES ('superadmin', 'roles.manage') ON CONFLICT DO NOTHING;
INSERT INTO app_role_permission (role_slug, permission_key) VALUES ('superadmin', 'api.management') ON CONFLICT DO NOTHING;
INSERT INTO app_role_permission (role_slug, permission_key) VALUES ('superadmin', 'config.view') ON CONFLICT DO NOTHING;
INSERT INTO app_role_permission (role_slug, permission_key) VALUES ('superadmin', 'config.edit') ON CONFLICT DO NOTHING;
INSERT INTO app_role_permission (role_slug, permission_key) VALUES ('superadmin', 'logs.view') ON CONFLICT DO NOTHING;
INSERT INTO app_role_permission (role_slug, permission_key) VALUES ('superadmin', 'dev.panel') ON CONFLICT DO NOTHING;
INSERT INTO app_role_permission (role_slug, permission_key) VALUES ('superadmin', 'maintenance.bypass') ON CONFLICT DO NOTHING;
