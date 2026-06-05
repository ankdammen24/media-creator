# media-creator-backend

Node.js/Express backend foundation for creator music uploads and audio processing for `api.mediarosenqvist.com`.

## Architecture principle

Lovable should own the frontend experience, but the backend must be fully owned by our server.

- `creator.mediarosenqvist.com` = Lovable creator frontend.
- `catalog.mediarosenqvist.com` = public listener frontend.
- `api.mediarosenqvist.com` = backend API on our own server.
- Cloudflare R2 = object storage for audio files and generated assets.
- Backend is the source of truth for tracks, files, jobs, review, distribution, and publication.

Lovable/Creator must never:

- store R2 secrets
- store database credentials
- perform audio processing
- decide final publish status
- expose private files directly
- overwrite original uploads

Backend must own:

- auth verification
- upload sessions
- presigned R2 URLs
- file ownership
- metadata validation
- processing jobs
- ffmpeg/ffprobe processing
- review workflow
- approval/rejection
- master creation
- distribution copies
- public catalog publishing
- audit logging

## Features

- JWT Bearer protected creator/admin endpoints with a verification placeholder.
- Presigned Cloudflare R2 upload/download URLs generated through the S3-compatible AWS SDK.
- PostgreSQL persistence for users, artists, albums, tracks, track files, processing jobs, and audit log entries.
- In-process audio processing queue triggered when uploads are confirmed.
- `ffprobe` technical metadata extraction.
- `ffmpeg` preview MP3 and normalized WAV generation.
- Separated creator private, admin review, public catalog, playback/download, and processing/internal endpoint groups.
- Health endpoints for service, PostgreSQL, and R2.
- Docker Compose stack with backend, PostgreSQL, and persistent database volume.

## File lifecycle

1. `uploads` = original creator upload.
2. `processing` = temporary/generated working files.
3. `masters` = approved master files.
4. `distribution` = public/API-ready copy of the master.

Original uploaded files are immutable and must never be overwritten. Distribution files are copies of the approved master, not the original upload.

## Conceptual flow

```text
creator upload
→ R2 uploads
→ processing job
→ preview/metadata generation
→ metadata completion
→ submission
→ admin review
→ approval
→ master creation
→ distribution copy
→ public catalog availability
```

## Requirements

- Node.js 22+
- PostgreSQL 16+
- ffmpeg/ffprobe available on PATH for local processing
- Cloudflare R2 bucket and S3-compatible credentials

## Setup

```bash
cd backend
cp .env.example .env
npm install
npm run migrate
npm run dev
```

The server defaults to `http://localhost:4000`.

## Docker

```bash
cd backend
cp .env.example .env
docker compose up --build
```

Run migrations against the Compose database:

```bash
docker compose run --rm backend npm run migrate
```

## Environment variables

| Variable | Description |
| --- | --- |
| `PORT` | HTTP port for Express. |
| `DATABASE_URL` | PostgreSQL connection string. |
| `R2_ACCOUNT_ID` | Cloudflare account ID used to build the R2 endpoint. |
| `R2_ACCESS_KEY_ID` | R2 S3-compatible access key ID. |
| `R2_SECRET_ACCESS_KEY` | R2 S3-compatible secret access key. |
| `R2_BUCKET_NAME` | R2 bucket for uploads and generated outputs. |
| `R2_PUBLIC_BASE_URL` | Optional public CDN/base URL for generated objects. |
| `JWT_SECRET` | Secret used by the placeholder JWT verifier. |
| `CORS_ORIGINS` | Comma-separated allowed origins. Defaults to creator and catalog Media Rosenqvist domains. |

## API overview

### Health

- `GET /health`
- `GET /health/database`
- `GET /health/storage`

### Creator private endpoints

All creator routes require an `Authorization: Bearer <token>` header.

- `POST /creator/uploads/session` creates uploading tracks, original file records, and presigned R2 upload URLs.
- `POST /creator/uploads/complete` marks the original file uploaded, creates a queued processing job, and starts the in-process worker.
- `GET /creator/tracks`
- `GET /creator/tracks/:trackId/status`
- `PATCH /creator/tracks/:trackId/metadata`
- `POST /creator/tracks/:trackId/submit`

Allowed upload content types are:

- `audio/wav`
- `audio/mpeg`
- `audio/flac`
- `audio/aiff`
- `audio/x-aiff`

### Admin review endpoints

Admin endpoints require a valid Bearer token with `role: "admin"`.

- `GET /admin/review/tracks?status=submitted`
- `POST /admin/review/tracks/:trackId/approve`
- `POST /admin/review/tracks/:trackId/reject`
- `POST /admin/tracks/:trackId/master`
- `POST /admin/tracks/:trackId/distribute`
- `POST /admin/tracks/:trackId/publish`

### Public catalog endpoints

Public catalog endpoints only return `published` tracks and do not expose private R2 keys.

- `GET /catalog/tracks`
- `GET /catalog/tracks/:trackId`

### Playback/download endpoints

Playback/download endpoints only sign `distribution/*` objects for published tracks.

- `GET /playback/tracks/:trackId/preview-url`
- `GET /playback/tracks/:trackId/download-url`

### Processing/internal status endpoint

- `GET /processing/jobs/:jobId`

## Processing flow

When an upload is completed, the backend:

1. Downloads `uploads/{creatorId}/{trackId}/original.{ext}` from R2 into `/tmp`.
2. Runs `ffprobe` and stores `processing/{trackId}/technical-metadata.json`.
3. Runs `ffmpeg` to create `processing/{trackId}/preview.mp3`.
4. Runs `ffmpeg` loudness normalization to create `processing/{trackId}/normalized.wav`.
5. Inserts generated `track_files` rows.
6. Marks the job `completed` and the track `processed`, or marks both failed on error.
7. Writes audit events for processing start, completion, or failure.

## Audit events

The backend writes audit log records for:

- upload session created
- upload completed
- processing started
- processing completed
- processing failed
- metadata updated
- submitted for review
- approved
- rejected
- master created
- distribution copy created
- published

## R2 logical paths

- `uploads/{creatorId}/{trackId}/original.{ext}`
- `processing/{trackId}/preview.mp3`
- `processing/{trackId}/technical-metadata.json`
- `processing/{trackId}/normalized.wav`
- `masters/{trackId}/master.wav`
- `distribution/{trackId}/master.wav`
- `distribution/{trackId}/preview.mp3`
- `distribution/{trackId}/metadata.json`
