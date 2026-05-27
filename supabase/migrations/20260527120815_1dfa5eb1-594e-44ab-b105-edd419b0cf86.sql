CREATE POLICY "Approved audio publicly readable"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (
  bucket_id = 'audio'
  AND EXISTS (
    SELECT 1 FROM public.submissions s
    WHERE s.audio_path = storage.objects.name
      AND s.status = 'approved'
  )
);