
-- Enum for album type
CREATE TYPE public.album_type AS ENUM ('album', 'ep', 'single', 'compilation');

-- Albums table
CREATE TABLE public.albums (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  artist_profile_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  release_date date,
  album_type public.album_type NOT NULL DEFAULT 'album',
  genre text,
  artwork_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_albums_artist_profile_id ON public.albums(artist_profile_id);
CREATE INDEX idx_albums_user_id ON public.albums(user_id);

GRANT SELECT ON public.albums TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.albums TO authenticated;
GRANT ALL ON public.albums TO service_role;

ALTER TABLE public.albums ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Albums readable by everyone"
  ON public.albums FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Users create own albums"
  ON public.albums FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.artist_profiles ap
      WHERE ap.id = albums.artist_profile_id
        AND (ap.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
    )
  );

CREATE POLICY "Owners or admins update albums"
  ON public.albums FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners or admins delete albums"
  ON public.albums FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_albums_updated_at
  BEFORE UPDATE ON public.albums
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add album_id and track_number to submissions
ALTER TABLE public.submissions
  ADD COLUMN album_id uuid REFERENCES public.albums(id) ON DELETE RESTRICT,
  ADD COLUMN track_number integer;

-- Backfill: create a single-album for each existing music submission
DO $$
DECLARE
  s RECORD;
  new_album_id uuid;
BEGIN
  FOR s IN
    SELECT id, user_id, artist_profile_id, title, artwork_path, created_at
    FROM public.submissions
    WHERE media_type = 'music' AND album_id IS NULL
  LOOP
    INSERT INTO public.albums (user_id, artist_profile_id, title, album_type, artwork_path, created_at, updated_at)
    VALUES (s.user_id, s.artist_profile_id, s.title, 'single', s.artwork_path, s.created_at, s.created_at)
    RETURNING id INTO new_album_id;

    UPDATE public.submissions
    SET album_id = new_album_id, track_number = 1
    WHERE id = s.id;
  END LOOP;
END $$;

-- Enforce constraints: music requires album+track, podcast forbids them
ALTER TABLE public.submissions
  ADD CONSTRAINT submissions_music_requires_album CHECK (
    (media_type = 'music' AND album_id IS NOT NULL AND track_number IS NOT NULL AND track_number >= 1)
    OR
    (media_type = 'podcast' AND album_id IS NULL AND track_number IS NULL)
  );

CREATE UNIQUE INDEX uniq_album_track ON public.submissions(album_id, track_number)
  WHERE album_id IS NOT NULL;

-- Trigger to ensure submission artist matches album artist
CREATE OR REPLACE FUNCTION public.check_submission_album_artist()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  album_artist uuid;
BEGIN
  IF NEW.album_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT artist_profile_id INTO album_artist FROM public.albums WHERE id = NEW.album_id;
  IF album_artist IS NULL THEN
    RAISE EXCEPTION 'Album % not found', NEW.album_id;
  END IF;
  IF album_artist <> NEW.artist_profile_id THEN
    RAISE EXCEPTION 'Submission artist must match album artist';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_submission_album_artist
  BEFORE INSERT OR UPDATE ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.check_submission_album_artist();
