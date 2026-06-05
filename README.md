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
