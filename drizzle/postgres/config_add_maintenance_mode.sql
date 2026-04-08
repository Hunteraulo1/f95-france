ALTER TABLE public.config
ADD COLUMN IF NOT EXISTS maintenance_mode boolean NOT NULL DEFAULT false;
