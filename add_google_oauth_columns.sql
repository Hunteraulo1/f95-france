-- Migration pour ajouter les colonnes OAuth2 à la table config
ALTER TABLE `config`
ADD COLUMN `google_oauth_client_id` TEXT NULL AFTER `google_api_key`,
ADD COLUMN `google_oauth_client_secret` TEXT NULL AFTER `google_oauth_client_id`,
ADD COLUMN `google_oauth_access_token` TEXT NULL AFTER `google_oauth_client_secret`,
ADD COLUMN `google_oauth_refresh_token` TEXT NULL AFTER `google_oauth_access_token`,
ADD COLUMN `google_oauth_token_expiry` DATETIME NULL AFTER `google_oauth_refresh_token`;
