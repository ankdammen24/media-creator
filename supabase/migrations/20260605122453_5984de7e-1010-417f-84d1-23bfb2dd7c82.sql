
-- Add disable fields to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_disabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS disabled_at timestamptz,
  ADD COLUMN IF NOT EXISTS disabled_by uuid;

-- Super admin / admin policies on profiles
DROP POLICY IF EXISTS "Super admins view all profiles" ON public.profiles;
CREATE POLICY "Super admins view all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Super admins update all profiles" ON public.profiles;
CREATE POLICY "Super admins update all profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

-- Super admins can view all user_roles (existing policy only lets users view their own)
DROP POLICY IF EXISTS "Super admins view all roles" ON public.user_roles;
CREATE POLICY "Super admins view all roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));

-- Update handle_new_user to grant creator role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'creator'::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Admin: set user role (super_admin only)
CREATE OR REPLACE FUNCTION public.admin_set_user_role(_target_user uuid, _new_role app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  DELETE FROM public.user_roles WHERE user_id = _target_user;
  INSERT INTO public.user_roles (user_id, role) VALUES (_target_user, _new_role);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_user_role(uuid, app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(uuid, app_role) TO authenticated;

-- Admin: enable/disable user (super_admin only)
CREATE OR REPLACE FUNCTION public.admin_set_user_disabled(_target_user uuid, _disabled boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.profiles
     SET is_disabled = _disabled,
         disabled_at = CASE WHEN _disabled THEN now() ELSE NULL END,
         disabled_by = CASE WHEN _disabled THEN auth.uid() ELSE NULL END,
         updated_at = now()
   WHERE user_id = _target_user;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_user_disabled(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_user_disabled(uuid, boolean) TO authenticated;
