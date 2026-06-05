# Media Creator — Frontend-only Portal Rebuild

## Goal

Reduce this app to a thin, authenticated creator UI. All catalog, storage,
audio processing, and distribution logic moves to the external API at
`https://api.mediarosenqvist.com`. Supabase stays only for sign-in; its JWT
is forwarded as a Bearer token to the external API.

## Scope decisions (confirmed)

- Strip everything: catalog, artists, albums, stats, admin, AzuraCast,
  audio-processing pipeline, public `/api/v1/*` and `/api/public/*` endpoints,
  shared player, notifications, API-keys UI.
- Keep Lovable Cloud auth (Supabase email/password + Google OAuth).
- No backend logic in Lovable: no `createServerFn`, no server routes, no
  Supabase reads/writes outside auth.

## What gets deleted

Routes
- `src/routes/index.tsx`, `about.tsx`, `catalog.tsx`, `stats.tsx`, `admin.tsx`
- `albums.$albumId.tsx`, `albums.$albumId.edit.tsx`, `albums.new.tsx`
- `artists.$artistId.tsx`, `artists.new.tsx`
- `my-submissions.tsx`, `notifications.tsx`, `releases.new.tsx`,
  `upload.tsx`, `upload-batch.tsx`, `settings.tsx`, `api-docs.tsx`
- Entire `src/routes/api/` tree (public endpoints, v1 endpoints, hooks,
  openapi, generate-artwork, generate-artist-image)

Server / library code
- `src/lib/azuracast-*`, `radio-spins-import.*`, `audio-processing.*`,
  `catalog-import.*`, `catalog-edit.*`, `stats.functions.ts`,
  `albums.functions.ts`, `artwork.functions.ts`, `artwork-sweep.server.ts`,
  `ai-image.server.ts`, `itunes.server.ts`, `admin-ownership.functions.ts`,
  `admin-users.functions.ts`, `api-keys.functions.ts`, `api-auth.server.ts`,
  `api-cors.ts`, `api-projections.ts`, `api-scopes.ts`, `openapi-spec.ts`,
  `notifications.functions.ts`, `notification-content.ts`,
  `artist-self-approve.functions.ts`, `release-platforms.ts`,
  `podcast-helpers.ts`, `album-helpers.ts`, `artist-list.ts`
- `worker/` directory (audio processor sits outside Lovable anyway)
- `supabase/migrations/*` are left in place (already applied; no schema
  changes needed — we just stop reading those tables)

Components
- All player components (`PreviewPlayer`, `NowPlaying`, `player/*`)
- Release wizard, album/artist editors, admin components, search,
  share button, source badge, submission actions, track card,
  AI artwork/image dialogs, storage error alert, show picker,
  album picker, language switcher, site header (replaced)

i18n
- Keep the i18n setup but reset locale files to the new creator strings.

## What stays

- `src/integrations/supabase/client.ts` (browser auth client only)
- `src/integrations/supabase/auth-attacher.ts` and `auth-middleware.ts`
  are removed — no server fns to attach to. `src/start.ts` reverts to
  no `functionMiddleware`.
- `src/lib/auth.tsx` (Supabase session provider/hook)
- `src/components/ProtectedRoute.tsx` pattern, but folded into the
  `_authenticated/route.tsx` layout per TanStack convention
- shadcn UI primitives under `src/components/ui/*`
- Theme provider, toggle, tooltips
- `src/styles.css` design tokens (kept; tweaked if needed)

## What gets built

### API client

`src/lib/api-client.ts` — thin fetch wrapper:
- Reads `import.meta.env.VITE_API_BASE_URL` (already
  `https://api.mediarosenqvist.com` in `.env`).
- On every call, attaches `Authorization: Bearer <supabase access_token>`
  from `supabase.auth.getSession()`.
- Returns typed JSON; throws `ApiError` with status + message on non-2xx.
- Handles 401 by signing the user out + redirect to `/auth`.

`src/lib/api-creator.ts` — typed wrappers per endpoint:
- `createUploadSession(files: { filename, size, contentType }[])`
  → `POST /creator/uploads/session` → `{ uploads: [{ trackId, putUrl, headers }] }`
- `completeUpload(trackId)` → `POST /creator/uploads/complete`
- `getTrackStatus(trackId)` → `GET /creator/tracks/{trackId}/status`
- `listTracks()`, `getTrack(id)`, `updateTrackMetadata(id, patch)`
- `listReleases()`, `getRelease(id)`, `createRelease(payload)`,
  `submitRelease(id)`, `submitTrack(id)`
- `getMe()`, `updateAccount(patch)`
- All wrapped in TanStack Query hooks under `src/lib/queries/*`.

### Routes

```
src/routes/
  __root.tsx              — shell, theme, query client, auth listener
  index.tsx               — redirects: signed-in → /dashboard, else → /auth
  auth.tsx                — sign-in + sign-up (email/password + Google)
  _authenticated/
    route.tsx             — integration-managed gate (ssr:false, getUser)
    dashboard.tsx         — Creator Dashboard (stats summary, recent activity)
    upload.tsx            — Upload Music (multi-file picker → R2 PUT)
    processing.tsx        — Processing Status (polls /status for in-flight tracks)
    tracks.tsx            — My Tracks (list + filters)
    tracks.$trackId.tsx   — Metadata Editor (per-track form)
    releases.tsx          — My Releases (list)
    releases.$releaseId.tsx — Release detail + Submission Review action
    distribution.tsx      — Distribution Status (per release/track platforms)
    account.tsx           — Account (display name, email, sign out)
```

Every page under `_authenticated/` is gated by the managed layout. Hard
refresh works (layout is `ssr:false` so localStorage session is read).

### Upload flow (Upload Music page)

1. User picks files (drag-drop or `<input type="file" multiple>`).
2. Client-side validation: extension/MIME, size cap.
3. Call `createUploadSession`; backend returns one `trackId` + presigned R2
   PUT URL per file.
4. For each file: `fetch(putUrl, { method: 'PUT', headers, body: file })`
   with per-file progress (XHR or fetch + `ReadableStream`).
5. On 2xx PUT: call `completeUpload(trackId)`.
6. Redirect to `/processing` with the new trackIds; that page polls
   `getTrackStatus` every 3 s until `processed` or `failed`.

### Shared layout

- New `src/components/AppShell.tsx` with side nav (Dashboard, Upload,
  Processing, Tracks, Releases, Distribution, Account) + user menu.
- Mobile: collapsible sheet nav.

### Auth

- Email/password + Google OAuth via the Lovable broker
  (`lovable.auth.signInWithOAuth("google", ...)`).
- `configure_social_auth` enables Google on Supabase the first time we
  ship the auth page.
- `src/routes/__root.tsx` keeps a single `onAuthStateChange` subscriber
  that invalidates the query client and router on identity changes.

### Environment & secrets

- `VITE_API_BASE_URL` already set.
- Existing secrets `AZURACAST_API_KEY`, `AUDIO_PROCESSOR_*`,
  `LOVABLE_API_KEY` become unused on the Lovable side. Leave them in
  place; do not delete (user may want them later, and the external API
  owns those concerns now).

## Out of scope

- The external API itself (you own it).
- Migration of existing catalog data (it stays in Supabase; the new UI
  simply doesn't read it).
- The audio-processing worker in `/worker` (deleted; lives on your VPS).
- Dropping Supabase tables (kept untouched in case you want to migrate
  data later).

## Order of operations

1. Delete legacy routes, components, lib files, and the `worker/` dir.
2. Reset `src/routes/__root.tsx` and `src/start.ts` to the minimal
   shell; drop server-fn middleware.
3. Add `_authenticated/route.tsx` (managed gate) and `auth.tsx`.
4. Build `api-client.ts` + typed `api-creator.ts` + Query hooks.
5. Build the 9 pages + `AppShell` nav.
6. Reset i18n locale files to creator-portal strings (sv default; en, no,
   da, fi, is kept as stubs you can fill in).
7. Verify build, then walk the upload flow once against a stub endpoint
   to confirm headers/CORS.

## Risks / open questions to confirm during build

- **CORS on api.mediarosenqvist.com**: must allow the Lovable preview
  origin and your custom domain, plus `Authorization` + any
  R2-presigned-URL headers if those are same-origin proxied.
- **R2 PUT CORS**: presigned URLs go to Cloudflare directly; your R2
  bucket needs the preview origin allowed for `PUT` with the headers
  the presign requires (typically `Content-Type`, sometimes
  `x-amz-*`).
- **Token expiry**: Supabase access tokens last 1 h. The fetch wrapper
  refreshes via `supabase.auth.getSession()` on each call, which auto-
  refreshes; long uploads should still finish because the PUT goes
  straight to R2 with a presigned URL (no Bearer needed there).
- **No API spec yet**: I'll assume the request/response shapes from
  your message. As soon as the real shapes differ, we patch
  `api-creator.ts` types in one place.