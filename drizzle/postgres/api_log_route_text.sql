-- api_log.route : varchar(255) → text (chemins longs, pas de troncature applicative)
ALTER TABLE public.api_log ALTER COLUMN route SET DATA TYPE text;
