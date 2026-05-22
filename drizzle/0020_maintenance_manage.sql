INSERT INTO
    app_permission (
        key,
        label,
        description,
        "group"
    )
VALUES (
        'maintenance.manage',
        'Activer la maintenance',
        'Activer ou désactiver le mode maintenance du site',
        'Système'
    )
ON CONFLICT (key) DO NOTHING;
--> statement-breakpoint
INSERT INTO
    app_role_permission (role_slug, permission_key)
VALUES (
        'superadmin',
        'maintenance.manage'
    )
ON CONFLICT DO NOTHING;
