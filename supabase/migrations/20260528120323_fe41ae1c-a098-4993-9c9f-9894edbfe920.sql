
-- 1. Drop privilege-escalating "any artist" policies
DROP POLICY IF EXISTS "Artists update any album" ON public.albums;
DROP POLICY IF EXISTS "Artists delete any album" ON public.albums;
DROP POLICY IF EXISTS "Artists insert any album" ON public.albums;

DROP POLICY IF EXISTS "Artists read all images" ON public.artist_images;
DROP POLICY IF EXISTS "Artists update any image" ON public.artist_images;
DROP POLICY IF EXISTS "Artists delete any image" ON public.artist_images;
DROP POLICY IF EXISTS "Artists insert any image" ON public.artist_images;

DROP POLICY IF EXISTS "Artists update any artist profile" ON public.artist_profiles;
DROP POLICY IF EXISTS "Artists delete any artist profile" ON public.artist_profiles;

DROP POLICY IF EXISTS "Artists view all submissions" ON public.submissions;
DROP POLICY IF EXISTS "Artists update any submission" ON public.submissions;
DROP POLICY IF EXISTS "Artists delete any submission" ON public.submissions;

DROP POLICY IF EXISTS "Artists insert submission_artists" ON public.submission_artists;
DROP POLICY IF EXISTS "Artists update submission_artists" ON public.submission_artists;
DROP POLICY IF EXISTS "Artists delete submission_artists" ON public.submission_artists;

-- 2. Restrict profiles SELECT to self + admin
DROP POLICY IF EXISTS "Profiles readable by authenticated" ON public.profiles;

CREATE POLICY "Users view own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins view all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 3. Hide artist_profiles.user_id from anonymous visitors (column-level)
REVOKE SELECT ON public.artist_profiles FROM anon;
GRANT SELECT (
  id, name, bio, avatar_path, website_url,
  facebook_url, x_url, spotify_url, apple_music_url,
  amazon_music_url, instagram_url, created_at, updated_at
) ON public.artist_profiles TO anon;

-- 4. Remove broad listing on artwork bucket (public URLs still work via CDN)
DROP POLICY IF EXISTS "Artwork publicly readable" ON storage.objects;

-- 5. Lock down SECURITY DEFINER helpers (still usable inside RLS / triggers)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_submission_album_artist() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
