ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS azuracast_file_id integer,
  ADD COLUMN IF NOT EXISTS azuracast_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS azuracast_sync_error text;

CREATE INDEX IF NOT EXISTS submissions_azuracast_file_id_idx
  ON public.submissions (azuracast_file_id)
  WHERE azuracast_file_id IS NOT NULL;