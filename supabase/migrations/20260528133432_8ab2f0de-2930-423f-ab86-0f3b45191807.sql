-- Ny enum för bearbetningsstatus
DO $$ BEGIN
  CREATE TYPE public.audio_processing_status AS ENUM ('pending','processing','done','failed','skipped');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS audio_master_path text,
  ADD COLUMN IF NOT EXISTS audio_web_path text,
  ADD COLUMN IF NOT EXISTS processing_status public.audio_processing_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS processing_error text,
  ADD COLUMN IF NOT EXISTS loudness_i numeric,
  ADD COLUMN IF NOT EXISTS loudness_tp numeric,
  ADD COLUMN IF NOT EXISTS loudness_lra numeric,
  ADD COLUMN IF NOT EXISTS processed_at timestamptz;

CREATE INDEX IF NOT EXISTS submissions_processing_status_idx
  ON public.submissions (processing_status)
  WHERE processing_status <> 'done';