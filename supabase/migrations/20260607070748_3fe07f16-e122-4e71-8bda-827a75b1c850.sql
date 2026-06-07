
-- 1. Restrict public reads on sensitive tables: replace permissive policies with safe views

-- albums
DROP POLICY IF EXISTS "Published albums readable by everyone" ON public.albums;

CREATE OR REPLACE VIEW public.albums_public
WITH (security_invoker = off) AS
SELECT id, title, description, artist_profile_id, user_id, artwork_path, genre,
       secondary_genre, language, label, album_type, release_date, podcast_category,
       distribution_platforms, previously_released, upc, published_at, created_at, updated_at, status
  FROM public.albums
 WHERE status = 'published'::release_status;

GRANT SELECT ON public.albums_public TO anon, authenticated;

-- artist_profiles
DROP POLICY IF EXISTS "Approved artist profiles readable by everyone" ON public.artist_profiles;

CREATE OR REPLACE VIEW public.artist_profiles_public
WITH (security_invoker = off) AS
SELECT id, user_id, name, bio, avatar_path, website_url, facebook_url, instagram_url,
       x_url, spotify_url, apple_music_url, amazon_music_url, created_at, updated_at, approval_status
  FROM public.artist_profiles
 WHERE approval_status = 'approved'::artist_approval_status;

GRANT SELECT ON public.artist_profiles_public TO anon, authenticated;

-- submissions
DROP POLICY IF EXISTS "Approved submissions readable by everyone" ON public.submissions;

CREATE OR REPLACE VIEW public.submissions_public
WITH (security_invoker = off) AS
SELECT id, title, description, media_type, artist_profile_id, user_id, album_id,
       artwork_path, audio_path, track_number, version, featured_artists, isrc,
       explicit, instrumental, ai_generated, preview_start_seconds, songwriters,
       producers, dolby_atmos_available, duration_seconds, upc, hosts, guests,
       episode_type, episode_number, season_number, scheduled_publish_at,
       created_at, updated_at, status
  FROM public.submissions
 WHERE status = 'approved'::submission_status;

GRANT SELECT ON public.submissions_public TO anon, authenticated;

-- media_files
DROP POLICY IF EXISTS "Approved or published media_files readable by everyone" ON public.media_files;

CREATE OR REPLACE VIEW public.media_files_public
WITH (security_invoker = off) AS
SELECT id, owner_id, submission_id, album_id, artist_profile_id, kind, file_type,
       mime_type, size_bytes, duration_seconds, original_filename, project,
       metadata, created_at, updated_at, status
  FROM public.media_files
 WHERE status = ANY (ARRAY['approved'::text, 'published'::text]);

GRANT SELECT ON public.media_files_public TO anon, authenticated;

-- submission_artists: public anon reads originally tied to approved submissions; tighten
DROP POLICY IF EXISTS "submission_artists for approved readable by everyone" ON public.submission_artists;

-- 2. Storage: restrict public read on cover-art and audio-previews to approved content
DROP POLICY IF EXISTS "cover-art: public read" ON storage.objects;
CREATE POLICY "cover-art: approved publicly readable" ON storage.objects
FOR SELECT TO anon, authenticated
USING (
  bucket_id = 'cover-art'
  AND (
    EXISTS (SELECT 1 FROM public.submissions s WHERE s.artwork_path = storage.objects.name AND s.status = 'approved'::submission_status)
    OR EXISTS (SELECT 1 FROM public.albums a WHERE a.artwork_path = storage.objects.name AND a.status = 'published'::release_status)
  )
);
-- Owners can still read their own
CREATE POLICY "cover-art: owner read" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'cover-art' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "audio-previews: public read" ON storage.objects;
CREATE POLICY "audio-previews: approved publicly readable" ON storage.objects
FOR SELECT TO anon, authenticated
USING (
  bucket_id = 'audio-previews'
  AND EXISTS (
    SELECT 1 FROM public.submissions s
     WHERE (s.audio_web_path = storage.objects.name OR s.audio_path = storage.objects.name)
       AND s.status = 'approved'::submission_status
  )
);
CREATE POLICY "audio-previews: owner read" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'audio-previews' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 3. Lock down SECURITY DEFINER functions: revoke broad EXECUTE
-- Trigger functions: nobody should call directly
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_artist_approval() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_media_file_status_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_submission_album_artist() FROM PUBLIC, anon, authenticated;

-- Admin-only RPCs: revoke anon
REVOKE ALL ON FUNCTION public.admin_set_user_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(uuid, app_role) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_set_user_disabled(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_disabled(uuid, boolean) TO authenticated;

REVOKE ALL ON FUNCTION public.self_approve_artist_account(uuid, text, text, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.self_approve_artist_account(uuid, text, text, text, text, uuid) TO authenticated;

-- has_role is used inside RLS policies; needs to be callable by authenticated and anon
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO anon, authenticated;
