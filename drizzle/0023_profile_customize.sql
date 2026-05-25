ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "profile_bio" text;
--> statement-breakpoint
INSERT INTO
    app_permission (
        key,
        label,
        description,
        "group"
    )
VALUES (
        'profile.customize',
        'Profil personnalisé',
        'Personnaliser son profil (bio, fond, musique, curseur)',
        'Général'
    )
ON CONFLICT (key) DO NOTHING;
--> statement-breakpoint
INSERT INTO
    app_role_permission (role_slug, permission_key)
VALUES (
        'superadmin',
        'profile.customize'
    )
ON CONFLICT DO NOTHING;
