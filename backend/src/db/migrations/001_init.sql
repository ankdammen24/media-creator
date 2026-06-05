create extension if not exists pgcrypto;

create table if not exists users (
  id text primary key,
  email text,
  role text not null default 'creator',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists artists (
  id uuid primary key default gen_random_uuid(),
  creator_id text not null references users(id) on delete cascade,
  name text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists albums (
  id uuid primary key default gen_random_uuid(),
  creator_id text not null references users(id) on delete cascade,
  artist_id uuid references artists(id) on delete set null,
  title text not null,
  upc text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists tracks (
  id uuid primary key default gen_random_uuid(),
  creator_id text not null references users(id) on delete cascade,
  artist_id uuid references artists(id) on delete set null,
  album_id uuid references albums(id) on delete set null,
  title text,
  isrc text,
  upc text,
  status text not null default 'draft' check (status in (
    'draft', 'uploading', 'uploaded', 'processing', 'processed', 'metadata_required', 'submitted',
    'reviewing', 'approved', 'rejected', 'mastering', 'mastered', 'distributed', 'published', 'failed'
  )),
  metadata jsonb not null default '{}'::jsonb,
  technical_metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists track_files (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references tracks(id) on delete cascade,
  file_type text not null check (file_type in (
    'original', 'normalized', 'preview', 'technical_metadata', 'master', 'distribution_master',
    'distribution_preview', 'artwork'
  )),
  filename text not null,
  content_type text not null,
  size_bytes bigint,
  r2_key text not null,
  status text not null default 'pending_upload',
  uploaded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (track_id, file_type, r2_key)
);

create table if not exists processing_jobs (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references tracks(id) on delete cascade,
  input_file_id uuid references track_files(id) on delete set null,
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed')),
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id text references users(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_tracks_creator_id on tracks(creator_id);
create index if not exists idx_track_files_track_id on track_files(track_id);
create index if not exists idx_processing_jobs_track_id on processing_jobs(track_id);
create index if not exists idx_processing_jobs_status on processing_jobs(status);
