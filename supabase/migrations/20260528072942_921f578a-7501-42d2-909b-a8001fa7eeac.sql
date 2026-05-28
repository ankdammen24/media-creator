
-- 1) Extra kolumner på artist_profiles
ALTER TABLE public.artist_profiles
  ADD COLUMN IF NOT EXISTS avatar_path text,
  ADD COLUMN IF NOT EXISTS website_url text,
  ADD COLUMN IF NOT EXISTS facebook_url text,
  ADD COLUMN IF NOT EXISTS instagram_url text,
  ADD COLUMN IF NOT EXISTS x_url text,
  ADD COLUMN IF NOT EXISTS spotify_url text,
  ADD COLUMN IF NOT EXISTS apple_music_url text,
  ADD COLUMN IF NOT EXISTS amazon_music_url text;

-- 2) Join-tabell submission_artists
CREATE TABLE IF NOT EXISTS public.submission_artists (
  submission_id uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  artist_profile_id uuid NOT NULL REFERENCES public.artist_profiles(id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT false,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (submission_id, artist_profile_id)
);

CREATE INDEX IF NOT EXISTS submission_artists_artist_idx
  ON public.submission_artists (artist_profile_id);
CREATE INDEX IF NOT EXISTS submission_artists_submission_idx
  ON public.submission_artists (submission_id);

-- 3) GRANTs (rader är publika via befintliga submissions/artist_profiles-policies)
GRANT SELECT ON public.submission_artists TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.submission_artists TO authenticated;
GRANT ALL ON public.submission_artists TO service_role;

-- 4) RLS
ALTER TABLE public.submission_artists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "submission_artists readable by everyone"
  ON public.submission_artists
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Owners or admins insert submission_artists"
  ON public.submission_artists
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.submissions s
      WHERE s.id = submission_artists.submission_id
        AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "Owners or admins update submission_artists"
  ON public.submission_artists
  FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.submissions s
      WHERE s.id = submission_artists.submission_id
        AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "Owners or admins delete submission_artists"
  ON public.submission_artists
  FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.submissions s
      WHERE s.id = submission_artists.submission_id
        AND s.user_id = auth.uid()
    )
  );

-- 5) Backfill från befintliga submissions
INSERT INTO public.submission_artists (submission_id, artist_profile_id, is_primary, position)
SELECT id, artist_profile_id, true, 0
FROM public.submissions
WHERE artist_profile_id IS NOT NULL
ON CONFLICT DO NOTHING;
