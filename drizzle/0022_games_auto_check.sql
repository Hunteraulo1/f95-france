INSERT INTO
    app_permission (
        key,
        label,
        description,
        "group"
    )
VALUES (
        'games.auto_check',
        'Auto-check (jeu et traductions)',
        'Activer ou désactiver l’auto-check sur les fiches F95, modifier l’auto-check des traductions et actualiser les versions via le checker',
        'Contenu'
    )
ON CONFLICT (key) DO NOTHING;
--> statement-breakpoint
INSERT INTO
    app_role_permission (role_slug, permission_key)
VALUES ('admin', 'games.auto_check')
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO
    app_role_permission (role_slug, permission_key)
VALUES ('superadmin', 'games.auto_check')
ON CONFLICT DO NOTHING;
