# Authentication & Authorization Plan

Add complete Supabase Auth to the Crystal Pier Records Creator Portal with email/password, password reset, registration, role-based access, and an admin user management page.

## Key notes about current state

- Supabase Auth is already wired (`src/integrations/supabase/client.ts`, `src/lib/auth.tsx`) with email/password + Google sign-in on `/auth`.
- A `profiles` table and `user_roles` table already exist. Roles use an `app_role` enum (currently `admin`, `artist`, etc.) with a `has_role()` SECURITY DEFINER function. This is the recommended Supabase pattern and we should KEEP roles in `user_roles`, not move them into `profiles` (storing roles on `profiles` is a known privilege-escalation footgun — I'll flag this to you).
- Routes are protected via `src/routes/_authenticated/route.tsx` (TanStack pathless layout) — equivalent to a `ProtectedRoute` component. Unauth users redirect to `/auth`.
- No `/login`, `/register`, `/forgot-password`, `/reset-password`, or `/admin/users` pages exist yet.

## What I'll build

### 1. Database migration
- Extend `app_role` enum to include `super_admin` and `creator` (keep existing `admin`, `artist`).
- Add `is_disabled boolean` + `disabled_at`, `disabled_by` columns to `profiles`.
- Add RLS policies: super_admin can read/update all profiles and manage `user_roles` (insert/update/delete). Admin can read all profiles.
- Add a `block_disabled_users()` trigger-friendly check via a SECURITY DEFINER RPC `admin_set_user_role(target_user, new_role)` and `admin_set_user_disabled(target_user, disabled)` — both gated by `has_role(auth.uid(),'super_admin')`. This avoids the frontend doing privileged writes directly.
- Keep `user_roles` as source of truth (NOT roles on profiles). I'll explain this trade-off vs your spec.

### 2. Auth pages (new top-level routes)
- `/login` — email + password, link to register and forgot password. Redirects authed users to `/dashboard`.
- `/register` — email, password, display name. Sends confirmation email.
- `/forgot-password` — calls `resetPasswordForEmail` with `redirectTo: <origin>/reset-password`.
- `/reset-password` — handles `type=recovery`, calls `supabase.auth.updateUser({ password })`.
- Keep existing `/auth` as a redirect to `/login` for back-compat (or delete — your call).

### 3. ProtectedRoute
- The `_authenticated` layout already gates the app. I'll also add a `RequireRole` wrapper used by admin routes that checks `has_role` via a server-validated query (not just client state) and blocks disabled users.

### 4. Profile page
- `/account` exists — extend it to show email, display name, role(s), change password, sign out.

### 5. Admin user management
- New pathless layout `_authenticated/_admin/` with `beforeLoad` checking admin/super_admin role (queries `user_roles`).
- `/admin/users` page: list users (join `profiles` + `user_roles`), change role (super_admin only), enable/disable user (super_admin only). All mutations go through the SECURITY DEFINER RPCs.

### 6. Disabled user enforcement
- On sign-in / session load: check `profiles.is_disabled`; if true, sign out and show message. Also enforced via RLS (disabled users' policies short-circuit).

### 7. Env vars
- `.env` already has `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Supabase renamed `anon_key` → `publishable_key`; they're the same thing. I'll keep the current naming (it's what the auto-generated client uses) rather than rename — let me know if you want both names supported.

## Questions before I build

1. **Roles on `profiles` vs `user_roles`**: Your spec says "store roles in profiles table" but this enables privilege escalation (a user with UPDATE on their own profile row could promote themselves). Standard Supabase pattern is a separate `user_roles` table with a SECURITY DEFINER `has_role()` function — which you already have. OK to keep roles in `user_roles`?
2. **Default role on signup**: New signups → `creator`? (vs. requiring admin approval first)
3. **`/auth` page**: Delete it and use `/login` + `/register`, or keep `/auth` as a combined page?
4. **Existing `artist` role**: Keep it alongside the new roles, or migrate `artist` → `creator`?

Once you answer these I'll implement in one pass (migration + pages + admin UI).