-- 1. Add missing foreign keys for albums + artist_images
ALTER TABLE public.albums
  ADD CONSTRAINT albums_artist_profile_id_fkey
    FOREIGN KEY (artist_profile_id) REFERENCES public.artist_profiles(id) ON DELETE CASCADE,
  ADD CONSTRAINT albums_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.artist_images
  ADD CONSTRAINT artist_images_artist_profile_id_fkey
    FOREIGN KEY (artist_profile_id) REFERENCES public.artist_profiles(id) ON DELETE CASCADE,
  ADD CONSTRAINT artist_images_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_albums_artist_profile_id ON public.albums(artist_profile_id);
CREATE INDEX IF NOT EXISTS idx_albums_user_id ON public.albums(user_id);
CREATE INDEX IF NOT EXISTS idx_artist_images_artist_profile_id ON public.artist_images(artist_profile_id);
CREATE INDEX IF NOT EXISTS idx_artist_images_user_id ON public.artist_images(user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_artist_profile_id ON public.submissions(artist_profile_id);
CREATE INDEX IF NOT EXISTS idx_submissions_album_id ON public.submissions(album_id);
CREATE INDEX IF NOT EXISTS idx_submissions_user_id ON public.submissions(user_id);

-- 2. Audit log for artist ownership changes
CREATE TABLE public.artist_ownership_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_profile_id uuid NOT NULL REFERENCES public.artist_profiles(id) ON DELETE CASCADE,
  from_user_id uuid NOT NULL,
  to_user_id uuid NOT NULL,
  changed_by uuid NOT NULL,
  affected_albums integer NOT NULL DEFAULT 0,
  affected_submissions integer NOT NULL DEFAULT 0,
  affected_images integer NOT NULL DEFAULT 0,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.artist_ownership_log TO authenticated;
GRANT ALL ON public.artist_ownership_log TO service_role;

ALTER TABLE public.artist_ownership_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read ownership log"
  ON public.artist_ownership_log
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_artist_ownership_log_artist ON public.artist_ownership_log(artist_profile_id, created_at DESC);
CREATE INDEX idx_artist_ownership_log_created ON public.artist_ownership_log(created_at DESC);

-- 3. Reload PostgREST schema cache so new FKs become joinable immediately
NOTIFY pgrst, 'reload schema';