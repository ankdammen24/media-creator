
-- Enum for playback event types
CREATE TYPE public.playback_event_type AS ENUM ('play', 'completed_30s', 'radio_spin');

-- Raw event log. All writes go through serverFn using service_role.
CREATE TABLE public.playback_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  event_type public.playback_event_type NOT NULL,
  user_id uuid,
  session_id text,
  source text,
  azuracast_played_at timestamptz,
  azuracast_song_id text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_playback_events_submission ON public.playback_events (submission_id, event_type);
CREATE INDEX idx_playback_events_occurred ON public.playback_events (occurred_at DESC);
-- Idempotency for radio spins: same azuracast play recorded once.
CREATE UNIQUE INDEX uniq_playback_events_radio_spin
  ON public.playback_events (submission_id, azuracast_played_at)
  WHERE event_type = 'radio_spin';

GRANT ALL ON public.playback_events TO service_role;
ALTER TABLE public.playback_events ENABLE ROW LEVEL SECURITY;
-- No anon/authenticated policies: access only via service_role through serverFn.

-- Tracks last successful radio import to make weekly pulls incremental.
CREATE TABLE public.radio_import_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL DEFAULT 'radio_uppsala',
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  spins_inserted integer NOT NULL DEFAULT 0,
  spins_skipped integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'running',
  error text,
  window_start timestamptz,
  window_end timestamptz
);

CREATE INDEX idx_radio_import_runs_completed ON public.radio_import_runs (completed_at DESC);

GRANT SELECT ON public.radio_import_runs TO authenticated;
GRANT ALL ON public.radio_import_runs TO service_role;
ALTER TABLE public.radio_import_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read radio_import_runs"
  ON public.radio_import_runs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
