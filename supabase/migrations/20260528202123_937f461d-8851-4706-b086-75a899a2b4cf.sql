ALTER TYPE public.album_type ADD VALUE IF NOT EXISTS 'podcast_show';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'podcast_episode_type') THEN
    CREATE TYPE public.podcast_episode_type AS ENUM ('full', 'trailer', 'bonus');
  END IF;
END $$;

ALTER TABLE public.albums
  ADD COLUMN IF NOT EXISTS podcast_category text;

ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS season_number integer,
  ADD COLUMN IF NOT EXISTS episode_number integer,
  ADD COLUMN IF NOT EXISTS episode_type public.podcast_episode_type NOT NULL DEFAULT 'full',
  ADD COLUMN IF NOT EXISTS hosts text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS guests text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS scheduled_publish_at timestamptz;