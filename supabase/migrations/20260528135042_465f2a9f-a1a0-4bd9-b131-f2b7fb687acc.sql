-- Restrict artist role to owner-scoped access only.
-- The artist role should not grant blanket write access to other users' catalog data.

-- artist_profiles
DROP POLICY IF EXISTS "Users delete own artist profiles" ON public.artist_profiles;
DROP POLICY IF EXISTS "Users update own artist profiles" ON public.artist_profiles;

CREATE POLICY "Owners or admins delete artist profiles"
ON public.artist_profiles FOR DELETE TO authenticated
USING ((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners or admins update artist profiles"
ON public.artist_profiles FOR UPDATE TO authenticated
USING ((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role));

-- albums
DROP POLICY IF EXISTS "Owners and editors read all albums" ON public.albums;
DROP POLICY IF EXISTS "Owners or admins delete albums" ON public.albums;
DROP POLICY IF EXISTS "Owners or admins update albums" ON public.albums;
DROP POLICY IF EXISTS "Users create own albums" ON public.albums;

CREATE POLICY "Owners and admins read all albums"
ON public.albums FOR SELECT TO authenticated
USING ((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners or admins delete albums"
ON public.albums FOR DELETE TO authenticated
USING ((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners or admins update albums"
ON public.albums FOR UPDATE TO authenticated
USING ((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK ((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users create own albums"
ON public.albums FOR INSERT TO authenticated
WITH CHECK (
  (auth.uid() = user_id) AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.artist_profiles ap
      WHERE ap.id = albums.artist_profile_id AND ap.user_id = auth.uid()
    )
  )
);

-- submissions
DROP POLICY IF EXISTS "Owners insert own submissions" ON public.submissions;
DROP POLICY IF EXISTS "Owners update own submissions" ON public.submissions;

CREATE POLICY "Owners insert own submissions"
ON public.submissions FOR INSERT TO authenticated
WITH CHECK (
  (auth.uid() = user_id) AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.artist_profiles ap
      WHERE ap.id = submissions.artist_profile_id AND ap.user_id = auth.uid()
    )
  )
);

CREATE POLICY "Owners update own submissions"
ON public.submissions FOR UPDATE TO authenticated
USING ((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK ((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role));

-- submission_artists
DROP POLICY IF EXISTS "Owners or admins delete submission_artists" ON public.submission_artists;
DROP POLICY IF EXISTS "Owners or admins insert submission_artists" ON public.submission_artists;
DROP POLICY IF EXISTS "Owners or admins update submission_artists" ON public.submission_artists;

CREATE POLICY "Owners or admins delete submission_artists"
ON public.submission_artists FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.submissions s
    WHERE s.id = submission_artists.submission_id AND s.user_id = auth.uid()
  )
);

CREATE POLICY "Owners or admins insert submission_artists"
ON public.submission_artists FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.submissions s
    WHERE s.id = submission_artists.submission_id AND s.user_id = auth.uid()
  )
);

CREATE POLICY "Owners or admins update submission_artists"
ON public.submission_artists FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.submissions s
    WHERE s.id = submission_artists.submission_id AND s.user_id = auth.uid()
  )
);

-- artist_images
DROP POLICY IF EXISTS "Owners insert own images" ON public.artist_images;
DROP POLICY IF EXISTS "Owners or admins delete images" ON public.artist_images;
DROP POLICY IF EXISTS "Owners or admins update images" ON public.artist_images;

CREATE POLICY "Owners insert own images"
ON public.artist_images FOR INSERT TO authenticated
WITH CHECK (
  (auth.uid() = user_id) AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.artist_profiles ap
      WHERE ap.id = artist_images.artist_profile_id AND ap.user_id = auth.uid()
    )
  )
);

CREATE POLICY "Owners or admins delete images"
ON public.artist_images FOR DELETE TO authenticated
USING ((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners or admins update images"
ON public.artist_images FOR UPDATE TO authenticated
USING ((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK ((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role));