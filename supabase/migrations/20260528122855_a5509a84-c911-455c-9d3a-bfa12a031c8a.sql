
-- Album fields
ALTER TABLE public.albums
  ADD COLUMN IF NOT EXISTS upc text,
  ADD COLUMN IF NOT EXISTS external_catalog_source text,
  ADD COLUMN IF NOT EXISTS metadata_imported_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_albums_upc ON public.albums(upc);

-- Submission fields
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS upc text,
  ADD COLUMN IF NOT EXISTS external_catalog_source text,
  ADD COLUMN IF NOT EXISTS metadata_imported_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_submissions_isrc ON public.submissions(isrc);

-- import_runs
CREATE TABLE IF NOT EXISTS public.import_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source text NOT NULL DEFAULT 'xlsx',
  filename text,
  created_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'preview',
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_runs TO authenticated;
GRANT ALL ON public.import_runs TO service_role;

ALTER TABLE public.import_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read import_runs" ON public.import_runs
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins insert import_runs" ON public.import_runs
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND created_by = auth.uid());
CREATE POLICY "Admins update import_runs" ON public.import_runs
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins delete import_runs" ON public.import_runs
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- import_rows
CREATE TABLE IF NOT EXISTS public.import_rows (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id uuid NOT NULL REFERENCES public.import_runs(id) ON DELETE CASCADE,
  sheet_name text,
  row_index integer,
  artist_name_raw text,
  album_title_raw text,
  track_title_raw text,
  upc_raw text,
  isrc_raw text,
  match_status text NOT NULL DEFAULT 'unmatched',
  matched_artist_id uuid,
  matched_album_id uuid,
  matched_submission_id uuid,
  proposed_changes jsonb NOT NULL DEFAULT '{}'::jsonb,
  applied_changes jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_import_rows_run ON public.import_rows(run_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_rows TO authenticated;
GRANT ALL ON public.import_rows TO service_role;

ALTER TABLE public.import_rows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read import_rows" ON public.import_rows
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins insert import_rows" ON public.import_rows
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update import_rows" ON public.import_rows
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins delete import_rows" ON public.import_rows
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
