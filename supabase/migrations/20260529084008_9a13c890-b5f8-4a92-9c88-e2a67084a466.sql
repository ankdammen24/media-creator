-- Restrict anonymous read access to internal/admin columns on publicly-readable tables.
REVOKE SELECT (internal_notes, rights_accepted_at, external_catalog_source, metadata_imported_at) ON public.albums FROM anon;

REVOKE SELECT (rejection_reason, reviewed_by, reviewed_at) ON public.artist_profiles FROM anon;

REVOKE SELECT (
  audio_master_path,
  atmos_audio_path,
  azuracast_unique_id,
  processing_error,
  loudness_i,
  loudness_tp,
  loudness_lra,
  approved_by,
  reviewed_by,
  rejection_reason
) ON public.submissions FROM anon;

-- Tighten submission_artists: previously every authenticated user could read every row.
DROP POLICY IF EXISTS "submission_artists readable by authenticated" ON public.submission_artists;

CREATE POLICY "submission_artists readable by owners admins and approved"
  ON public.submission_artists
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.submissions s
      WHERE s.id = submission_artists.submission_id
        AND (s.user_id = auth.uid() OR s.status = 'approved'::submission_status)
    )
  );
