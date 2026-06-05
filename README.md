# Media Creator

Media Creator is the authenticated creator portal for the Media Rosenqvist music ecosystem.

This repository contains the **frontend-only** creator application for:

`creator.mediarosenqvist.com`

Media Creator is **not** the public music catalog and it is not a backend service. It is a thin React UI that authenticates creators, forwards their Supabase access token to the Media API, and displays backend-provided state.

## Purpose

Media Creator allows artists, labels, and content creators to:

- Upload music files
- Manage track and release metadata
- Track audio processing status
- Submit tracks and releases for review
- Follow distribution status
- Manage creator account information

The frontend does not decide publish status, persist business data, process audio, manage storage credentials, or expose private files. Those responsibilities belong to the Media API.

## Related Services

### Media Creator

Frontend creator portal.

**Domain:**

`creator.mediarosenqvist.com`

**Responsibilities:**

- Supabase Auth sign-in UI
- Creator session handling
- Upload workflow UI
- Direct browser upload to presigned R2 URLs returned by the API
- Metadata editing UI
- Processing status polling
- Track/release submission UI
- Distribution status display
- Creator account UI

### Media Catalog

Public listener-facing catalog.

**Domain:**

`catalog.mediarosenqvist.com`

**Responsibilities:**

- Public music discovery
- Playback experiences
- Artist pages
- Album pages
- Public catalog API consumption

Media Creator must not implement public listener catalog pages, public playback, artist pages, album pages, or public API behavior.

### Media API

Backend platform and source of truth.

**Domain:**

`api.mediarosenqvist.com`

**Responsibilities:**

- Authentication validation
- Upload orchestration
- Presigned Cloudflare R2 URL generation
- File ownership and upload confirmation
- Metadata storage and validation
- Processing job creation and status tracking
- Audio processing with backend workers
- Review workflow
- Approval and rejection
- Master creation
- Distribution copy creation
- Catalog publishing
- Audit logging

All business logic is handled by the Media API. The creator frontend only sends authenticated requests and renders API responses.

### Cloudflare R2

Object storage for music assets.

**Storage lifecycle:**

```text
uploads/       original creator uploads
processing/    generated working files and analysis outputs
masters/       approved master files
distribution/  public/API-ready copies for catalog and delivery
```

Original uploads are immutable. Distribution files are copies of approved masters, not direct references to original uploads.

## Architecture

Media Creator is a frontend-only application.

```text
Creator Browser
  → Media Creator React app
  → Supabase Auth for sign-in/session/JWT
  → Media API for all creator data and workflows
  → Cloudflare R2 only through presigned URLs returned by Media API
```

The frontend forwards the Supabase access token to the API using:

```http
Authorization: Bearer <supabase access_token>
```

The frontend must not contain or execute:

- Backend routes
- Express handlers
- TanStack server functions
- Supabase database reads or writes
- Database credentials
- R2 secrets or SDK clients
- API secrets
- ffmpeg/ffprobe processing
- Processing workers
- Admin/review decision logic
- Public catalog/player logic

## Technology Stack

- React
- TypeScript
- Vite
- TanStack Router
- TanStack Query
- Supabase Auth
- shadcn/ui primitives
- Docker
- Nginx

## Routes

Public/auth routes:

- `/`
- `/auth`

Authenticated creator routes:

- `/dashboard`
- `/upload`
- `/processing`
- `/tracks`
- `/tracks/:trackId`
- `/releases`
- `/releases/:releaseId`
- `/distribution`
- `/account`

All routes except `/` and `/auth` require a Supabase session. If a creator is not signed in, they are redirected to `/auth`. If a creator is signed in and visits `/`, they are redirected to `/dashboard`.

## Authentication Model

Authentication is provided by Supabase Auth.

Supported login methods:

- Email and password
- Google OAuth

Supabase is used only for:

- Browser sign-in
- Session persistence
- Access-token refresh
- JWT retrieval

No business data is stored in Supabase by this frontend. No Supabase database tables are read from or written to by this frontend.

## API Model

The API base URL is configured with:

```text
VITE_API_BASE_URL=https://api.mediarosenqvist.com
```

Every authenticated Media API request includes the current Supabase access token:

```http
Authorization: Bearer <supabase access_token>
```

The frontend treats the Media API as the source of truth for:

- Track status
- File status
- Processing status
- Metadata state
- Review state
- Distribution state
- Publish state

The frontend must not infer final publication state locally.

## Upload Lifecycle

1. Creator selects one or more audio files.
2. Frontend validates file type and file size locally.
3. Frontend calls `POST /creator/uploads/session` on the Media API.
4. Media API creates upload/session records and returns one presigned Cloudflare R2 PUT URL per file.
5. Browser uploads each file directly to R2 with `PUT`.
6. Frontend calls `POST /creator/uploads/complete` for each successful upload.
7. Media API confirms ownership, marks upload complete, and starts backend processing.
8. Frontend redirects the creator to `/processing`.
9. Frontend polls `GET /creator/tracks/{trackId}/status` every three seconds while active.
10. Creator continues to metadata editing when backend processing succeeds.

The frontend never stores R2 secrets and never overwrites original uploads.

## Status Lifecycle

Track and release statuses are provided by the Media API. Common lifecycle states include:

```text
draft
uploaded
processing
processed
submitted
reviewing
approved
rejected
mastered
distributed
published
failed
```

The creator UI displays backend-provided state and available next actions. Final review, approval, mastering, distribution, and publishing decisions are owned by the Media API.

## Environment Variables

Required for local development and production builds:

| Variable | Description |
| --- | --- |
| `VITE_API_BASE_URL` | Media API base URL. Expected value: `https://api.mediarosenqvist.com`. |
| `VITE_SUPABASE_URL` | Supabase project URL used by browser auth. |
| `VITE_SUPABASE_ANON_KEY` | Supabase public anon key used by browser auth. |

The code also accepts `VITE_SUPABASE_PUBLISHABLE_KEY` as an alias for environments that name the public browser key that way.

Copy `.env.example` for local development:

```bash
cp .env.example .env
```

Do not put service-role keys, database credentials, R2 credentials, or API secrets in frontend environment variables.

## Local Development

Install dependencies:

```bash
npm install
```

Run the Vite dev server:

```bash
npm run dev
```

Run static checks:

```bash
npm run typecheck
npm run lint
```

Build the static frontend:

```bash
npm run build
```

Preview a production build locally:

```bash
npm run preview
```

## Docker Deployment

The application is deployed as a static frontend container served by Nginx.

Traffic flow:

```text
Cloudflare
→ Existing Nginx Reverse Proxy
→ Media Creator Container
```

This project does not use Traefik. The existing external Docker-based Nginx reverse proxy handles:

- Public domain routing
- HTTPS/TLS certificates
- Reverse proxying to this container
- `creator.mediarosenqvist.com`

### Docker Local Build

```bash
docker compose up --build
```

The local compose file maps:

```text
localhost:8088 → container:80
```

### Docker Image Build

```bash
docker build \
  --build-arg VITE_API_BASE_URL=https://api.mediarosenqvist.com \
  -t media-creator .
```

If needed for a local image, also pass:

```bash
--build-arg VITE_SUPABASE_URL=...
--build-arg VITE_SUPABASE_ANON_KEY=...
```

Only public browser configuration should be passed to the frontend image.

### Run Container Locally

```bash
docker run -p 8088:80 media-creator
```

### Production Compose

Production uses `docker-compose.prod.yml`:

```yaml
services:
  media-creator:
    image: ghcr.io/mediarosenqvist/media-creator:latest
    container_name: media-creator
    restart: unless-stopped
    expose:
      - "80"
    networks:
      - media-net

networks:
  media-net:
    external: true
```

Deploy or update production:

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

The production container exposes internal port 80 only. The existing external Nginx proxy should attach to the `media-net` Docker network and route traffic to the `media-creator` container.

## Nginx Static Serving

The container Nginx config:

- Serves `dist/` from `/usr/share/nginx/html`
- Enables gzip
- Caches static assets aggressively
- Avoids aggressive caching for `index.html`
- Falls back to `index.html` for unknown routes

This enables hard refreshes for SPA routes such as:

- `/auth`
- `/dashboard`
- `/upload`
- `/processing`
- `/tracks/:trackId`
- `/releases/:releaseId`
- `/account`

## Project Status

Current phase:

**Frontend-only Creator Portal Refactor**

The legacy catalog, player, admin, and processing functionality have been removed from this frontend and replaced by external Media API integration.

## Future Development Rules

When adding new features:

- Keep business logic in the Media API.
- Keep this project frontend-only.
- Use Supabase only for browser auth/session/JWT retrieval.
- Use TanStack Query for API state and polling.
- Do not add server functions, backend routes, databases, Redis, ffmpeg, R2 SDKs, or workers to this repository.
- Do not implement public catalog or player behavior here; that belongs to Media Catalog.
