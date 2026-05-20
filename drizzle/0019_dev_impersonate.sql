INSERT INTO
    app_permission (
        key,
        label,
        description,
        "group"
    )
VALUES (
        'dev.impersonate',
        'Changer d''utilisateur (Dev)',
        'Basculer la session vers un autre compte utilisateur (mode développeur)',
        'Système'
    )
ON CONFLICT (key) DO NOTHING;
--> statement-breakpoint
INSERT INTO
    app_role_permission (role_slug, permission_key)
VALUES (
        'superadmin',
        'dev.impersonate'
    )
ON CONFLICT DO NOTHING;
