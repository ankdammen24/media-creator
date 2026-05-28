
CREATE TABLE public.audio_processing_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NULL,
  event text NOT NULL,
  level text NOT NULL DEFAULT 'info',
  message text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audio_processing_logs_created_at_idx ON public.audio_processing_logs (created_at DESC);
CREATE INDEX audio_processing_logs_submission_idx ON public.audio_processing_logs (submission_id, created_at DESC);

GRANT SELECT ON public.audio_processing_logs TO authenticated;
GRANT ALL ON public.audio_processing_logs TO service_role;

ALTER TABLE public.audio_processing_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read audio logs"
ON public.audio_processing_logs
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
