# Media Creator

Frontend-only creator portal for Media Rosenqvist.

The app is a thin authenticated React/TanStack UI. It uses Supabase only for browser authentication, session handling, and JWT retrieval. All catalog, storage, upload orchestration, metadata persistence, review, distribution, stats, admin, public API, and audio-processing logic belongs to the external API at `https://api.mediarosenqvist.com`.

## Runtime architecture

- React frontend with TanStack Router and TanStack Query.
- Supabase browser auth only.
- Supabase access tokens are forwarded to the API as `Authorization: Bearer <supabase access_token>`.
- No frontend backend routes, server functions, database access, R2 SDK/secrets, ffmpeg, or processing workers.

## Environment

Copy `.env.example` and provide the public browser config needed by Vite:

```bash
cp .env.example .env
```

`VITE_API_BASE_URL` defaults operationally to `https://api.mediarosenqvist.com` in the app and Docker examples.

## Local development

```bash
npm install
npm run dev
```

## Docker

The Docker image is a static production build served by Nginx. It does not contain `.env` files or backend services. At container startup, Nginx writes a public `/env.js` from container environment variables so deployment config can be supplied without rebuilding the image.

### Local build

```bash
docker compose up --build
```

The local compose file maps `http://localhost:8088` to the container's port 80.

### Production image build

```bash
docker build \
  --build-arg VITE_API_BASE_URL=https://api.mediarosenqvist.com \
  -t media-creator .
```

If you need to bake Supabase public browser configuration into a local image, also pass `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` as build args. Do not pass private service-role keys or backend secrets.

### Run locally

```bash
docker run -p 8088:80 media-creator
```

### Production deploy

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

The production compose file expects an external Traefik network named `proxy` and routes `creator.mediarosenqvist.com` over the `websecure` entrypoint with the `letsencrypt` resolver.

## SPA routing

`nginx.conf` serves `index.html` as a fallback for unknown routes, so hard refreshes work for routes such as:

- `/auth`
- `/dashboard`
- `/upload`
- `/processing`
- `/tracks/:trackId`
- `/releases/:releaseId`
- `/account`

Static assets are cached aggressively, while `index.html` is not cached aggressively.

## Bootstrapping the first super admin

Roles live in `public.user_roles` (not on `profiles`), so promotion happens by inserting a row there. There is no hardcoded super-admin email in the frontend — the first super admin is granted manually via SQL after registering.

### 1. Register the first account

1. Start the app and open `/register`.
2. Sign up with **`caj.rosenqvist@mediarosenqvist.com`** and a password.
3. Confirm the email if email confirmation is enabled. After confirming, sign in at `/login`.

At this point the account exists in `auth.users` and has a `profiles` row + the default `creator` role (assigned by the `handle_new_user` trigger). The `/admin/users` page is not yet accessible.

### 2. Promote the account to `super_admin`

Run the bootstrap script in the Supabase SQL Editor (or via `psql`):

- File: [`supabase/manual/promote-super-admin.sql`](supabase/manual/promote-super-admin.sql)

The script looks up the user by email in `auth.users`, inserts `('user_id', 'super_admin')` into `public.user_roles` (idempotent), and prints a `NOTICE` with the granted user id. It raises an error if the account has not registered yet.

### 3. Verify super-admin access

1. Sign out and sign back in (so the new role is picked up on the next session load).
2. The "Admin" section should appear in the sidebar.
3. Navigate to `/admin/users` — you should see the user list and be able to change roles and enable/disable users.
4. Optional SQL check (run in SQL Editor):

   ```sql
   select u.email, ur.role
     from public.user_roles ur
     join auth.users u on u.id = ur.user_id
    where lower(u.email) = lower('caj.rosenqvist@mediarosenqvist.com');
   ```

   You should see a row with `role = super_admin`.

