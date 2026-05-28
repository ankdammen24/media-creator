-- Enums
CREATE TYPE public.artist_image_kind AS ENUM ('avatar', 'cover', 'press');
CREATE TYPE public.artist_image_visibility AS ENUM ('public', 'link_only');

-- Table
CREATE TABLE public.artist_images (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  artist_profile_id uuid NOT NULL,
  user_id uuid NOT NULL,
  storage_path text NOT NULL,
  kind public.artist_image_kind NOT NULL DEFAULT 'press',
  is_primary boolean NOT NULL DEFAULT false,
  visibility public.artist_image_visibility NOT NULL DEFAULT 'public',
  caption text,
  credit text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Partial unique index: only one primary per (artist, kind)
CREATE UNIQUE INDEX artist_images_primary_unique
  ON public.artist_images (artist_profile_id, kind)
  WHERE is_primary;

CREATE INDEX artist_images_artist_idx
  ON public.artist_images (artist_profile_id, kind, sort_order);

-- Grants
GRANT SELECT ON public.artist_images TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.artist_images TO authenticated;
GRANT ALL ON public.artist_images TO service_role;

-- RLS
ALTER TABLE public.artist_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public images readable by everyone"
ON public.artist_images
FOR SELECT
TO anon, authenticated
USING (visibility = 'public');

CREATE POLICY "Owners and admins read all own images"
ON public.artist_images
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners insert own images"
ON public.artist_images
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.artist_profiles ap
    WHERE ap.id = artist_images.artist_profile_id
      AND (ap.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  )
);

CREATE POLICY "Owners or admins update images"
ON public.artist_images
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners or admins delete images"
ON public.artist_images
FOR DELETE
TO authenticated
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

-- updated_at trigger
CREATE TRIGGER set_artist_images_updated_at
BEFORE UPDATE ON public.artist_images
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();