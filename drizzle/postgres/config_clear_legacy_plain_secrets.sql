-- Après migration des secrets vers les variables d’environnement, exécuter pour
-- retirer les copies en clair encore présentes en base (optionnel).
-- Voir la page /dashboard/config pour la liste des noms de variables.

UPDATE public.config
SET
	discord_webhook_updates = NULL,
	discord_webhook_logs = NULL,
	discord_webhook_translators = NULL,
	discord_webhook_proofreaders = NULL,
	google_api_key = NULL,
	google_oauth_client_id = NULL,
	google_oauth_client_secret = NULL
WHERE id = 'main';

-- Les jetons OAuth (google_oauth_access_token, google_oauth_refresh_token) sont
-- toujours stockés en base après le flux OAuth ; avec CONFIG_TOKEN_ENCRYPTION_KEY
-- ils sont enregistrés chiffrés par l’application.
