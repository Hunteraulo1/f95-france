UPDATE app_permission
SET
    "group" = 'Profil personnalisé',
    label = CASE key
        WHEN 'profile.customize.bio' THEN 'Bio'
        WHEN 'profile.customize.background' THEN 'Image de fond'
        WHEN 'profile.customize.music' THEN 'Musique'
        WHEN 'profile.customize.cursor' THEN 'Curseur'
        ELSE label
    END
WHERE
    key IN (
        'profile.customize.bio',
        'profile.customize.background',
        'profile.customize.music',
        'profile.customize.cursor'
    );
