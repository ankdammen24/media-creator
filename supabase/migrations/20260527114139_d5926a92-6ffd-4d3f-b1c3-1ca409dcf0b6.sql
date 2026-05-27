
-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Artist profiles
CREATE TABLE public.artist_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  bio text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.artist_profiles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.artist_profiles TO authenticated;
GRANT ALL ON public.artist_profiles TO service_role;

ALTER TABLE public.artist_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Artist profiles readable by everyone"
  ON public.artist_profiles FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Users create own artist profiles"
  ON public.artist_profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own artist profiles"
  ON public.artist_profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own artist profiles"
  ON public.artist_profiles FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_artist_profiles_updated_at
  BEFORE UPDATE ON public.artist_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Submissions
CREATE TYPE public.media_type AS ENUM ('music', 'podcast');
CREATE TYPE public.submission_status AS ENUM ('pending_review', 'approved', 'rejected');

CREATE TABLE public.submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  artist_profile_id uuid NOT NULL REFERENCES public.artist_profiles(id) ON DELETE CASCADE,
  media_type public.media_type NOT NULL,
  title text NOT NULL,
  description text,
  audio_path text NOT NULL,
  artwork_path text NOT NULL,
  status public.submission_status NOT NULL DEFAULT 'pending_review',
  rejection_reason text,
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_submissions_status ON public.submissions(status);
CREATE INDEX idx_submissions_user ON public.submissions(user_id);
CREATE INDEX idx_submissions_profile ON public.submissions(artist_profile_id);

GRANT SELECT ON public.submissions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.submissions TO authenticated;
GRANT ALL ON public.submissions TO service_role;

ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

-- Public can only see approved
CREATE POLICY "Approved submissions readable by everyone"
  ON public.submissions FOR SELECT TO anon, authenticated
  USING (status = 'approved');

-- Owners see their own (any status)
CREATE POLICY "Owners view own submissions"
  ON public.submissions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Admins see all
CREATE POLICY "Admins view all submissions"
  ON public.submissions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Owners insert own submissions"
  ON public.submissions FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.artist_profiles ap
      WHERE ap.id = artist_profile_id AND ap.user_id = auth.uid()
    )
  );

CREATE POLICY "Owners update own pending submissions"
  ON public.submissions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND status = 'pending_review');

CREATE POLICY "Admins update any submission"
  ON public.submissions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_submissions_updated_at
  BEFORE UPDATE ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('artwork', 'artwork', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('audio', 'audio', false);

-- Artwork policies (public read, owner write to own folder)
CREATE POLICY "Artwork publicly readable"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'artwork');

CREATE POLICY "Users upload own artwork"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'artwork' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users update own artwork"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'artwork' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own artwork"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'artwork' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Audio policies (private, owner read+write, admin read)
CREATE POLICY "Owners read own audio"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'audio' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admins read all audio"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'audio' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users upload own audio"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'audio' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own audio"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'audio' AND auth.uid()::text = (storage.foldername(name))[1]);
