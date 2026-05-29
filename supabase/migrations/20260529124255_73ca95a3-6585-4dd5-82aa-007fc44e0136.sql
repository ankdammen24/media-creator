CREATE OR REPLACE FUNCTION public.self_approve_artist_account(
  _user_id uuid,
  _mode text,
  _name text DEFAULT NULL,
  _bio text DEFAULT NULL,
  _website text DEFAULT NULL,
  _artist_profile_id uuid DEFAULT NULL
)
RETURNS TABLE(id uuid, name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_id uuid;
  v_new_name text;
  v_existing public.artist_profiles%ROWTYPE;
BEGIN
  -- Disable the enforce_artist_approval trigger for this transaction only.
  PERFORM set_config('session_replication_role', 'replica', true);

  IF _mode = 'create' THEN
    IF _name IS NULL OR length(btrim(_name)) = 0 THEN
      RAISE EXCEPTION 'name_required';
    END IF;
    -- Case-insensitive duplicate name guard
    IF EXISTS (SELECT 1 FROM public.artist_profiles ap WHERE ap.name ILIKE _name) THEN
      RAISE EXCEPTION 'duplicate_artist:%', _name;
    END IF;

    INSERT INTO public.artist_profiles
      (user_id, name, bio, website_url, approval_status, reviewed_by, reviewed_at)
    VALUES
      (_user_id, btrim(_name),
       NULLIF(btrim(coalesce(_bio, '')), ''),
       NULLIF(btrim(coalesce(_website, '')), ''),
       'approved'::artist_approval_status,
       _user_id, now())
    RETURNING artist_profiles.id, artist_profiles.name
    INTO v_new_id, v_new_name;

  ELSIF _mode = 'approveExisting' THEN
    SELECT * INTO v_existing FROM public.artist_profiles ap WHERE ap.id = _artist_profile_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
    IF v_existing.user_id <> _user_id THEN RAISE EXCEPTION 'forbidden'; END IF;

    UPDATE public.artist_profiles
       SET approval_status = 'approved'::artist_approval_status,
           reviewed_by = _user_id,
           reviewed_at = now(),
           rejection_reason = NULL
     WHERE artist_profiles.id = _artist_profile_id;

    v_new_id := v_existing.id;
    v_new_name := v_existing.name;
  ELSE
    RAISE EXCEPTION 'invalid_mode';
  END IF;

  -- Grant artist role (idempotent)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'artist'::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Restore default trigger firing (function scope ends anyway, but be explicit)
  PERFORM set_config('session_replication_role', 'origin', true);

  id := v_new_id;
  name := v_new_name;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.self_approve_artist_account(uuid, text, text, text, text, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.self_approve_artist_account(uuid, text, text, text, text, uuid) TO service_role;