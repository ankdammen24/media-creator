-- 1) albums: restrict anon to published only; add authenticated owner/admin/artist read
DROP POLICY IF EXISTS "Albums readable by everyone" ON public.albums;

CREATE POLICY "Published albums readable by everyone"
ON public.albums
FOR SELECT
TO anon, authenticated
USING (status = 'published'::release_status);

CREATE POLICY "Owners and editors read all albums"
ON public.albums
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'artist'::app_role)
);

-- 2) submissions: column-level GRANTs for anon (hide internal fields)
REVOKE SELECT ON public.submissions FROM anon;
GRANT SELECT (
  id,
  title,
  description,
  artwork_path,
  audio_path,
  media_type,
  artist_profile_id,
  album_id,
  track_number,
  version,
  featured_artists,
  isrc,
  explicit,
  instrumental,
  ai_generated,
  preview_start_seconds,
  songwriters,
  producers,
  dolby_atmos_available,
  duration_seconds,
  upc,
  status,
  created_at,
  updated_at
) ON public.submissions TO anon;

-- 3) submission_artists: anon only sees links to approved submissions
DROP POLICY IF EXISTS "submission_artists readable by everyone" ON public.submission_artists;

CREATE POLICY "submission_artists for approved readable by everyone"
ON public.submission_artists
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.submissions s
    WHERE s.id = submission_artists.submission_id
      AND s.status = 'approved'::submission_status
  )
);

CREATE POLICY "submission_artists readable by authenticated"
ON public.submission_artists
FOR SELECT
TO authenticated
USING (true);