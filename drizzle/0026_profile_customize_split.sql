INSERT INTO
    app_permission (key, label, description, "group")
VALUES
    (
        'profile.customize.bio',
        'Bio',
        'Modifier la bio affichée sur le profil public',
        'Profil personnalisé'
    ),
    (
        'profile.customize.background',
        'Image de fond',
        'Modifier l’image de fond du profil public',
        'Profil personnalisé'
    ),
    (
        'profile.customize.music',
        'Musique',
        'Ajouter une musique YouTube / YouTube Music sur le profil public',
        'Profil personnalisé'
    ),
    (
        'profile.customize.cursor',
        'Curseur',
        'Personnaliser le curseur affiché sur le profil public',
        'Profil personnalisé'
    )
ON CONFLICT (key) DO NOTHING;
--> statement-breakpoint
INSERT INTO
    app_role_permission (role_slug, permission_key)
SELECT role_slug, 'profile.customize.bio'
FROM app_role_permission
WHERE permission_key = 'profile.customize'
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO
    app_role_permission (role_slug, permission_key)
SELECT role_slug, 'profile.customize.background'
FROM app_role_permission
WHERE permission_key = 'profile.customize'
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO
    app_role_permission (role_slug, permission_key)
SELECT role_slug, 'profile.customize.music'
FROM app_role_permission
WHERE permission_key = 'profile.customize'
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO
    app_role_permission (role_slug, permission_key)
SELECT role_slug, 'profile.customize.cursor'
FROM app_role_permission
WHERE permission_key = 'profile.customize'
ON CONFLICT DO NOTHING;
--> statement-breakpoint
DELETE FROM app_role_permission
WHERE permission_key = 'profile.customize';
--> statement-breakpoint
DELETE FROM app_permission
WHERE key = 'profile.customize';
