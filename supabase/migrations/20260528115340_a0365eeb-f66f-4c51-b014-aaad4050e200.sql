
-- Release status enum
DO $$ BEGIN
  CREATE TYPE public.release_status AS ENUM ('draft','uploaded','under_review','approved','rejected','published');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Albums: release-level fields
ALTER TABLE public.albums
  ADD COLUMN IF NOT EXISTS label TEXT,
  ADD COLUMN IF NOT EXISTS language TEXT,
  ADD COLUMN IF NOT EXISTS secondary_genre TEXT,
  ADD COLUMN IF NOT EXISTS previously_released BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS distribution_platforms TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS status public.release_status NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS internal_notes TEXT,
  ADD COLUMN IF NOT EXISTS rights_accepted_at TIMESTAMPTZ;

-- Submissions: track-level fields
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS version TEXT,
  ADD COLUMN IF NOT EXISTS featured_artists TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS isrc TEXT,
  ADD COLUMN IF NOT EXISTS explicit BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS instrumental BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_generated BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS preview_start_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS songwriters TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS producers TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS dolby_atmos_available BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS atmos_audio_path TEXT,
  ADD COLUMN IF NOT EXISTS duration_seconds NUMERIC,
  ADD COLUMN IF NOT EXISTS loudness_lufs NUMERIC;

-- Profiles: notification prefs
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notification_prefs JSONB NOT NULL DEFAULT '{}'::jsonb;
