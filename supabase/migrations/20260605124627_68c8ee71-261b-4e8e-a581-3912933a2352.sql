
-- Re-create view with security_invoker so it enforces caller's RLS
CREATE OR REPLACE VIEW public.published_tracks_view
WITH (security_invoker = on) AS
SELECT
  s.id                 AS track_id,
  s.title              AS title,
  s.isrc               AS isrc,
  s.duration_seconds   AS duration_seconds,
  s.track_number       AS track_number,
  s.explicit           AS explicit,
  s.featured_artists   AS featured_artists,
  s.audio_web_path     AS preview_path,
  s.artwork_path       AS track_artwork_path,
  s.media_type         AS media_type,
  s.approved_at        AS approved_at,
  s.created_at         AS created_at,
  ap.id                AS artist_id,
  ap.name              AS artist_name,
  ap.avatar_path       AS artist_avatar_path,
  al.id                AS album_id,
  al.title             AS album_title,
  al.artwork_path      AS album_artwork_path,
  al.release_date      AS release_date,
  al.genre             AS genre,
  al.upc               AS upc,
  al.label             AS label
FROM public.submissions s
JOIN public.artist_profiles ap ON ap.id = s.artist_profile_id AND ap.approval_status = 'approved'
LEFT JOIN public.albums al ON al.id = s.album_id
WHERE s.status = 'approved'
  AND (s.album_id IS NULL OR al.status = 'published');

GRANT SELECT ON public.published_tracks_view TO anon, authenticated;

-- Narrow anon/auth SELECT on submissions: only approved rows
CREATE POLICY "Approved submissions readable by everyone"
  ON public.submissions FOR SELECT TO anon, authenticated
  USING (status = 'approved');

-- Narrow anon/auth SELECT on artist_profiles: only approved artists
CREATE POLICY "Approved artist profiles readable by everyone"
  ON public.artist_profiles FOR SELECT TO anon, authenticated
  USING (approval_status = 'approved');

-- Also let owners read their own artist profile (was missing)
CREATE POLICY "Owners read own artist profile"
  ON public.artist_profiles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'super_admin'::app_role));
