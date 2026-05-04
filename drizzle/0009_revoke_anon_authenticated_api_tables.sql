-- Retire l’exposition GraphQL (lint 0026 / 0027) : anon/authenticated ne doivent pas avoir SELECT sur ces tables serveur-only.
REVOKE ALL PRIVILEGES ON TABLE "api_key" FROM anon, authenticated;
--> statement-breakpoint
REVOKE ALL PRIVILEGES ON
TABLE "api_key_rate"
FROM anon, authenticated;
--> statement-breakpoint
REVOKE ALL PRIVILEGES ON
TABLE "login_throttle"
FROM anon, authenticated;
