
-- 1) Extend media_files with the S3 spec columns
ALTER TABLE public.media_files
  ADD COLUMN project text,
  ADD COLUMN file_type text CHECK (file_type IN ('audio_original','preview','cover_art','document')),
  ADD COLUMN original_filename text,
  ADD COLUMN storage_key text,
  ADD COLUMN status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved','rejected','published')),
  ADD COLUMN reviewed_by uuid,
  ADD COLUMN reviewed_at timestamptz,
  ADD COLUMN rejection_reason text;

-- Backfill new fields from existing rows so the unique index works
UPDATE public.media_files
   SET storage_key = COALESCE(storage_key, bucket || '/' || path),
       project = COALESCE(project, 'creator'),
       file_type = COALESCE(file_type,
         CASE kind
           WHEN 'audio_original' THEN 'audio_original'
           WHEN 'audio_preview'  THEN 'preview'
           WHEN 'cover_art'      THEN 'cover_art'
           WHEN 'document'       THEN 'document'
         END),
       original_filename = COALESCE(original_filename, regexp_replace(path, '^[^/]+/', ''));

-- bucket/path/kind are now optional (legacy Supabase-bucket flow)
ALTER TABLE public.media_files
  ALTER COLUMN bucket DROP NOT NULL,
  ALTER COLUMN path DROP NOT NULL,
  ALTER COLUMN kind DROP NOT NULL,
  ADD CONSTRAINT media_files_storage_key_unique UNIQUE (storage_key);

CREATE INDEX media_files_status_idx ON public.media_files(status);
CREATE INDEX media_files_project_idx ON public.media_files(project);

-- 2) Public read of approved/published files (Catalog uses this)
CREATE POLICY "Approved or published media_files readable by everyone"
  ON public.media_files FOR SELECT TO anon, authenticated
  USING (status IN ('approved','published'));

-- 3) Admins/super_admins can update status (approve, reject, publish)
CREATE POLICY "Admins update media_files status"
  ON public.media_files FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'super_admin'::app_role));

-- 4) Status-change audit log
CREATE TABLE public.media_file_status_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_file_id uuid NOT NULL REFERENCES public.media_files(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  reason text,
  changed_by uuid NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX media_file_status_log_file_idx ON public.media_file_status_log(media_file_id);

GRANT SELECT, INSERT ON public.media_file_status_log TO authenticated;
GRANT ALL ON public.media_file_status_log TO service_role;
ALTER TABLE public.media_file_status_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read own status log"
  ON public.media_file_status_log FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.media_files m WHERE m.id = media_file_status_log.media_file_id AND m.owner_id = auth.uid())
    OR public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'super_admin'::app_role)
  );

CREATE POLICY "Admins insert status log"
  ON public.media_file_status_log FOR INSERT TO authenticated
  WITH CHECK (
    changed_by = auth.uid()
    AND (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'super_admin'::app_role))
  );

-- 5) Trigger: append status log when media_files.status changes (admin path)
CREATE OR REPLACE FUNCTION public.log_media_file_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.media_file_status_log (media_file_id, from_status, to_status, reason, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, NEW.rejection_reason, COALESCE(auth.uid(), NEW.owner_id));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER media_files_status_change_log
  AFTER UPDATE OF status ON public.media_files
  FOR EACH ROW EXECUTE FUNCTION public.log_media_file_status_change();
