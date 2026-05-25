INSERT INTO
    app_permission (
        key,
        label,
        description,
        "group"
    )
VALUES (
        'games.silent_mode',
        'Mode silencieux',
        'Ajouter ou modifier des traductions sans envoyer de notification Discord (mode silencieux)',
        'Contenu'
    )
ON CONFLICT (key) DO NOTHING;
--> statement-breakpoint
INSERT INTO
    app_role_permission (role_slug, permission_key)
VALUES ('admin', 'games.silent_mode')
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO
    app_role_permission (role_slug, permission_key)
VALUES ('superadmin', 'games.silent_mode')
ON CONFLICT DO NOTHING;
