-- albums: allow admin/artist role to create on behalf of any artist
DROP POLICY IF EXISTS "Users create own albums" ON public.albums;
CREATE POLICY "Users create own albums"
ON public.albums
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'artist'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.artist_profiles ap
      WHERE ap.id = albums.artist_profile_id
        AND ap.user_id = auth.uid()
    )
  )
);

-- submissions: allow admin/artist role to create on behalf of any artist
DROP POLICY IF EXISTS "Owners insert own submissions" ON public.submissions;
CREATE POLICY "Owners insert own submissions"
ON public.submissions
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'artist'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.artist_profiles ap
      WHERE ap.id = submissions.artist_profile_id
        AND ap.user_id = auth.uid()
    )
  )
);

-- submissions update: allow admin/artist role to update any submission
DROP POLICY IF EXISTS "Owners update own submissions" ON public.submissions;
CREATE POLICY "Owners update own submissions"
ON public.submissions
FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'artist'::app_role)
)
WITH CHECK (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'artist'::app_role)
);

-- artist_images: allow admin/artist role to insert images for any artist
DROP POLICY IF EXISTS "Owners insert own images" ON public.artist_images;
CREATE POLICY "Owners insert own images"
ON public.artist_images
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'artist'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.artist_profiles ap
      WHERE ap.id = artist_images.artist_profile_id
        AND ap.user_id = auth.uid()
    )
  )
);

-- artist_images update/delete: also allow artist role
DROP POLICY IF EXISTS "Owners or admins update images" ON public.artist_images;
CREATE POLICY "Owners or admins update images"
ON public.artist_images
FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'artist'::app_role)
)
WITH CHECK (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'artist'::app_role)
);

DROP POLICY IF EXISTS "Owners or admins delete images" ON public.artist_images;
CREATE POLICY "Owners or admins delete images"
ON public.artist_images
FOR DELETE
TO authenticated
USING (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'artist'::app_role)
);

-- albums update/delete: allow artist role too
DROP POLICY IF EXISTS "Owners or admins update albums" ON public.albums;
CREATE POLICY "Owners or admins update albums"
ON public.albums
FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'artist'::app_role)
)
WITH CHECK (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'artist'::app_role)
);

DROP POLICY IF EXISTS "Owners or admins delete albums" ON public.albums;
CREATE POLICY "Owners or admins delete albums"
ON public.albums
FOR DELETE
TO authenticated
USING (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'artist'::app_role)
);

-- submission_artists: allow admin/artist role to link
DROP POLICY IF EXISTS "Owners or admins insert submission_artists" ON public.submission_artists;
CREATE POLICY "Owners or admins insert submission_artists"
ON public.submission_artists
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'artist'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.submissions s
    WHERE s.id = submission_artists.submission_id
      AND s.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Owners or admins update submission_artists" ON public.submission_artists;
CREATE POLICY "Owners or admins update submission_artists"
ON public.submission_artists
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'artist'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.submissions s
    WHERE s.id = submission_artists.submission_id
      AND s.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Owners or admins delete submission_artists" ON public.submission_artists;
CREATE POLICY "Owners or admins delete submission_artists"
ON public.submission_artists
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'artist'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.submissions s
    WHERE s.id = submission_artists.submission_id
      AND s.user_id = auth.uid()
  )
);

-- artist_profiles: allow admin/artist role to update/delete any profile
DROP POLICY IF EXISTS "Users update own artist profiles" ON public.artist_profiles;
CREATE POLICY "Users update own artist profiles"
ON public.artist_profiles
FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'artist'::app_role)
);

DROP POLICY IF EXISTS "Users delete own artist profiles" ON public.artist_profiles;
CREATE POLICY "Users delete own artist profiles"
ON public.artist_profiles
FOR DELETE
TO authenticated
USING (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'artist'::app_role)
);