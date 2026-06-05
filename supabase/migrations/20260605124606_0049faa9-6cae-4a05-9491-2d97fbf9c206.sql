
-- 1) media_files: richer per-file metadata, linkable to submissions/albums/artists
CREATE TABLE public.media_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  bucket text NOT NULL,
  path text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('audio_original','audio_preview','cover_art','document')),
  mime_type text,
  size_bytes bigint,
  duration_seconds numeric,
  checksum text,
  submission_id uuid REFERENCES public.submissions(id) ON DELETE CASCADE,
  album_id uuid REFERENCES public.albums(id) ON DELETE CASCADE,
  artist_profile_id uuid REFERENCES public.artist_profiles(id) ON DELETE CASCADE,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bucket, path)
);
CREATE INDEX media_files_owner_idx ON public.media_files(owner_id);
CREATE INDEX media_files_submission_idx ON public.media_files(submission_id);
CREATE INDEX media_files_album_idx ON public.media_files(album_id);
CREATE INDEX media_files_kind_idx ON public.media_files(kind);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_files TO authenticated;
GRANT ALL ON public.media_files TO service_role;

ALTER TABLE public.media_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners and admins read media_files"
  ON public.media_files FOR SELECT TO authenticated
  USING (auth.uid() = owner_id OR public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'super_admin'::app_role));

CREATE POLICY "Owners insert own media_files"
  ON public.media_files FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners or admins update media_files"
  ON public.media_files FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id OR public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (auth.uid() = owner_id OR public.has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "Owners or admins delete media_files"
  ON public.media_files FOR DELETE TO authenticated
  USING (auth.uid() = owner_id OR public.has_role(auth.uid(),'admin'::app_role));

CREATE TRIGGER media_files_set_updated_at
  BEFORE UPDATE ON public.media_files
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 2) approvals: audit log of every review decision
CREATE TABLE public.approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid REFERENCES public.submissions(id) ON DELETE CASCADE,
  album_id uuid REFERENCES public.albums(id) ON DELETE CASCADE,
  decision text NOT NULL CHECK (decision IN ('approved','rejected','pending','revoked')),
  reason text,
  decided_by uuid NOT NULL,
  decided_at timestamptz NOT NULL DEFAULT now(),
  CHECK (submission_id IS NOT NULL OR album_id IS NOT NULL)
);
CREATE INDEX approvals_submission_idx ON public.approvals(submission_id);
CREATE INDEX approvals_album_idx ON public.approvals(album_id);
CREATE INDEX approvals_decided_at_idx ON public.approvals(decided_at DESC);

GRANT SELECT, INSERT ON public.approvals TO authenticated;
GRANT ALL ON public.approvals TO service_role;

ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read all approvals"
  ON public.approvals FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'super_admin'::app_role));

CREATE POLICY "Owners read approvals of own items"
  ON public.approvals FOR SELECT TO authenticated
  USING (
    (submission_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.submissions s WHERE s.id = approvals.submission_id AND s.user_id = auth.uid()))
    OR (album_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.albums a WHERE a.id = approvals.album_id AND a.user_id = auth.uid()))
  );

CREATE POLICY "Admins insert approvals"
  ON public.approvals FOR INSERT TO authenticated
  WITH CHECK (
    decided_by = auth.uid()
    AND (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'super_admin'::app_role))
  );


-- 3) published_tracks_view: Catalog reads this. Definer-style (security_invoker off)
--    so anon/authenticated can read approved tracks without broad RLS on submissions.
CREATE OR REPLACE VIEW public.published_tracks_view
WITH (security_invoker = off) AS
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


-- 4) Storage policies for new buckets (buckets themselves are created via the storage tool).
--    audio-originals (private), audio-previews (public), cover-art (public), documents (private)

-- audio-originals: owner uploads to <uid>/..., owner+admin read/update/delete
CREATE POLICY "audio-originals: owner read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'audio-originals' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'super_admin'::app_role)));

CREATE POLICY "audio-originals: owner insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'audio-originals' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "audio-originals: owner update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'audio-originals' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(),'admin'::app_role)));

CREATE POLICY "audio-originals: owner delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'audio-originals' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(),'admin'::app_role)));

-- audio-previews: PUBLIC read; owner writes under <uid>/...
CREATE POLICY "audio-previews: public read"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'audio-previews');

CREATE POLICY "audio-previews: owner insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'audio-previews' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "audio-previews: owner update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'audio-previews' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(),'admin'::app_role)));

CREATE POLICY "audio-previews: owner delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'audio-previews' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(),'admin'::app_role)));

-- cover-art: PUBLIC read; owner writes
CREATE POLICY "cover-art: public read"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'cover-art');

CREATE POLICY "cover-art: owner insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'cover-art' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "cover-art: owner update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'cover-art' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(),'admin'::app_role)));

CREATE POLICY "cover-art: owner delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'cover-art' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(),'admin'::app_role)));

-- documents: private, owner+admin
CREATE POLICY "documents: owner read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documents' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'super_admin'::app_role)));

CREATE POLICY "documents: owner insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "documents: owner update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'documents' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(),'admin'::app_role)));

CREATE POLICY "documents: owner delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'documents' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(),'admin'::app_role)));
