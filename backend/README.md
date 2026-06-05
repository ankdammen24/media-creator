# media-creator-backend

Node.js/Express backend foundation for creator music uploads and audio processing for `creator.mediarosenqvist.com`.

## Features

- JWT Bearer protected creator endpoints with a verification placeholder.
- Presigned Cloudflare R2 upload URLs generated through the S3-compatible AWS SDK.
- PostgreSQL persistence for users, artists, albums, tracks, track files, processing jobs, and audit log entries.
- In-process audio processing queue triggered when uploads are confirmed.
- `ffprobe` technical metadata extraction.
- `ffmpeg` preview MP3 and normalized WAV generation.
- Health endpoints for service, PostgreSQL, and R2.
- Docker Compose stack with backend, PostgreSQL, and persistent database volume.

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

### Creator uploads

All creator routes require an `Authorization: Bearer <token>` header.

- `POST /creator/uploads/session` creates draft/uploading tracks, original file records, and presigned R2 upload URLs.
- `POST /creator/uploads/complete` marks the original file uploaded, creates a queued processing job, and starts the in-process worker.

Allowed upload content types are:

- `audio/wav`
- `audio/mpeg`
- `audio/flac`
- `audio/aiff`
- `audio/x-aiff`

### Creator tracks

- `GET /creator/tracks`
- `GET /creator/tracks/:trackId/status`
- `PATCH /creator/tracks/:trackId/metadata`
- `POST /creator/tracks/:trackId/submit`

## Processing flow

When an upload is completed, the backend:

1. Downloads `uploads/{creatorId}/{trackId}/original.{ext}` from R2 into `/tmp`.
2. Runs `ffprobe` and stores `processing/{trackId}/technical-metadata.json`.
3. Runs `ffmpeg` to create `processing/{trackId}/preview.mp3`.
4. Runs `ffmpeg` loudness normalization to create `processing/{trackId}/normalized.wav`.
5. Inserts generated `track_files` rows.
6. Marks the job `completed` and the track `processed`, or marks both failed on error.

## R2 logical paths

- `uploads/{creatorId}/{trackId}/original.{ext}`
- `processing/{trackId}/preview.mp3`
- `processing/{trackId}/technical-metadata.json`
- `processing/{trackId}/normalized.wav`
- `masters/{trackId}/master.wav`
- `distribution/{trackId}/master.wav`
- `distribution/{trackId}/preview.mp3`
- `distribution/{trackId}/metadata.json`
