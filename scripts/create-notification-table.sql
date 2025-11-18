-- Migration pour créer la table notification
-- À exécuter manuellement si la table n'existe pas encore

CREATE TABLE IF NOT EXISTS `notification` (
    `id` varchar(255) NOT NULL DEFAULT(UUID()),
    `user_id` varchar(255) NOT NULL,
    `type` enum(
        'submission_status_changed',
        'new_user_registered',
        'submission_accepted',
        'submission_rejected'
    ) NOT NULL,
    `title` varchar(255) NOT NULL,
    `message` text NOT NULL,
    `read` boolean NOT NULL DEFAULT false,
    `link` varchar(500),
    `metadata` text,
    `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `notification_id` PRIMARY KEY (`id`)
);

-- Ajouter la contrainte de clé étrangère (à exécuter séparément si la table existe déjà)
-- ALTER TABLE `notification` ADD CONSTRAINT `notification_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE cascade;
