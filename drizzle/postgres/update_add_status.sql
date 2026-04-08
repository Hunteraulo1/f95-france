ALTER TABLE public.update
ADD COLUMN IF NOT EXISTS status varchar(16) NOT NULL DEFAULT 'update';
