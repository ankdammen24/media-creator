-- Manual bootstrap: promote a registered account to super_admin.
--
-- Run this AFTER the target user has registered an account in the app.
-- Execute it in the Supabase SQL Editor (or psql against the project DB).
--
-- Target account:
--   caj.rosenqvist@mediarosenqvist.com
--
-- This inserts into public.user_roles, the dedicated roles table used by
-- has_role() and all RLS policies. Roles are intentionally NOT stored on
-- public.profiles (that would allow trivial privilege escalation through
-- the "Users update own profile" RLS policy).

do $$
declare
  v_user_id uuid;
begin
  select id
    into v_user_id
    from auth.users
   where lower(email) = lower('caj.rosenqvist@mediarosenqvist.com')
   limit 1;

  if v_user_id is null then
    raise exception
      'No auth.users row found for caj.rosenqvist@mediarosenqvist.com. Register the account in the app first, then re-run this script.';
  end if;

  insert into public.user_roles (user_id, role)
  values (v_user_id, 'super_admin'::app_role)
  on conflict (user_id, role) do nothing;

  raise notice 'Granted super_admin to user %', v_user_id;
end
$$;

-- Verify:
select u.email, ur.role
  from public.user_roles ur
  join auth.users u on u.id = ur.user_id
 where lower(u.email) = lower('caj.rosenqvist@mediarosenqvist.com');
