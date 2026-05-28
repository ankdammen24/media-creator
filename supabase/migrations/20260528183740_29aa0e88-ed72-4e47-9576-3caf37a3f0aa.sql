-- Enum for artist account approval status
DO $$ BEGIN
  CREATE TYPE public.artist_approval_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Add approval columns to artist_profiles
ALTER TABLE public.artist_profiles
  ADD COLUMN IF NOT EXISTS approval_status public.artist_approval_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Existing profiles are considered approved so the catalog is unaffected
UPDATE public.artist_profiles SET approval_status = 'approved' WHERE approval_status = 'pending';

-- Trigger to prevent non-admins from self-approving artist accounts
CREATE OR REPLACE FUNCTION public.enforce_artist_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin boolean;
BEGIN
  is_admin := public.has_role(auth.uid(), 'admin'::app_role);

  IF TG_OP = 'INSERT' THEN
    IF NOT is_admin THEN
      NEW.approval_status := 'pending';
      NEW.reviewed_by := NULL;
      NEW.reviewed_at := NULL;
      NEW.rejection_reason := NULL;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NOT is_admin THEN
      -- Non-admins cannot change moderation fields
      NEW.approval_status := OLD.approval_status;
      NEW.reviewed_by := OLD.reviewed_by;
      NEW.reviewed_at := OLD.reviewed_at;
      NEW.rejection_reason := OLD.rejection_reason;
    ELSE
      -- Stamp reviewer info when an admin changes the status
      IF NEW.approval_status IS DISTINCT FROM OLD.approval_status THEN
        NEW.reviewed_by := auth.uid();
        NEW.reviewed_at := now();
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_artist_approval_trigger ON public.artist_profiles;
CREATE TRIGGER enforce_artist_approval_trigger
BEFORE INSERT OR UPDATE ON public.artist_profiles
FOR EACH ROW
EXECUTE FUNCTION public.enforce_artist_approval();