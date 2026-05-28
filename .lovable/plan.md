## Mål
- Spara två varianter av varje låt: en **FLAC-master** med inbäddad metadata och en **AAC/M4A 128 kbps** för webbspelaren.
- Normalisera alla låtar enligt **EBU R128 strikt** (−23 LUFS integrerat, −1 dBTP, LRA 11) med ffmpegs `loudnorm`-filter i två pass.
- Bearbeta nya uppladdningar automatiskt, och kunna bakåtfylla befintliga (inkl. Radio Uppsala-importer) i bakgrunden.

## Arkitektur
ffmpeg kan inte köras i Cloudflare Worker-runtimen som appen ligger på. Vi sätter upp en separat **ffmpeg-worker** (Node + ffmpeg i en Docker-image) som Lovable Cloud-appen pratar med via HTTP. Worker körs t.ex. på Cloudflare Containers, Fly.io, Railway eller Hetzner — du väljer värd, koden förbereds redo att deploya.

Flöde:
```text
[Klient laddar upp]
       │
       ▼
[audio/<owner>/original/<id>.<ext>]  ← original sparas oförändrat
       │
       ▼
[App: enqueueAudioProcessing(submissionId)]
       │  POST /process  (signed download URL + metadata)
       ▼
[ffmpeg-worker]
   1. Pass 1: mät loudness
   2. Pass 2: producera FLAC-master (-23 LUFS, metadata embedded)
   3. Pass 2: producera AAC 128k web-version
   4. Ladda upp till audio-bucket
   5. POST /api/public/hooks/audio-processed (HMAC-signerad)
       │
       ▼
[App: uppdaterar submissions med paths + LUFS-värden + status=done]
```

## Förändringar i appen

### 1. Databas (migration)
Lägg till på `submissions`:
- `audio_master_path text` — FLAC-master med embedded metadata
- `audio_web_path text` — komprimerad webbfil (AAC 128k m4a)
- `processing_status` (ny enum: `pending | processing | done | failed | skipped`), default `pending`
- `processing_error text`
- `loudness_i numeric`, `loudness_tp numeric`, `loudness_lra numeric` — uppmätt på originalfilen
- `processed_at timestamptz`

`audio_path` behålls som "original" — vi byter inte namn på existerande filer (du sa att det inte behövs). Befintliga RLS-policys kan användas, men vi sätter dessa nya kolumner till skrivbara endast via service-role i callback-handlern.

### 2. Server functions (`src/lib/audio-processing.functions.ts`)
- `enqueueAudioProcessing({ submissionId })` — skyddad med `requireSupabaseAuth`. Hämtar submission, bygger embed-metadata (title, artist, album, track_number, ISRC, UPC, genre, release_date, artwork URL), skapar signed URL för originalet, POSTar till worker `/process` med HMAC-signerad payload.
- `enqueueAudioBackfill({ limit, onlyMissing })` — admin-only. Pagererar genom submissions där `processing_status != 'done'` och köar via worker. Returnerar `{ queued, skipped }`.
- `getProcessingStatus({ submissionId })` — för UI/polling.

### 3. Server route (`src/routes/api/public/hooks/audio-processed.ts`)
- `POST` callback från worker.
- Verifierar HMAC (header `x-signature` = `hmac_sha256(body, AUDIO_PROCESSOR_SECRET)`) med `timingSafeEqual`.
- Validerar med Zod: `{ submissionId, masterPath, webPath, loudness:{i,tp,lra}, error? }`.
- Använder `supabaseAdmin` för att skriva till submissions.

### 4. Uppdateringar i klient/uppladdningsflöden
- `src/routes/upload.tsx` och `src/components/release-wizard/ReleaseWizard.tsx`: när uppladdningen är klar, anropa `enqueueAudioProcessing` (fire-and-forget med toast "Bearbetar ljud i bakgrunden").
- `src/lib/azuracast-import.server.ts`: anropa `enqueueAudioProcessing` direkt efter att en fil laddats upp.
- Spelaren (`PlayerProvider.tsx` + `PlayButton` resolver, ev. `queries.ts`): välj källa i prioritetsordning `audio_web_path` → `audio_path`. Befintlig signed-URL-logik återanvänds.

### 5. Admin-UI
Liten panel i `src/routes/admin.tsx`:
- Räknare: antal submissions per `processing_status`.
- Knapp "Bakåtfyll bearbetning (100 i taget)" som anropar `enqueueAudioBackfill`.
- Per-låt-vy: visa LUFS-värden och om master/web finns.

### 6. Hemligheter
Behöver två nya secrets (begärs via `add_secret` när vi börjar bygga):
- `AUDIO_PROCESSOR_URL` — t.ex. `https://media-processor.mydomain.com`
- `AUDIO_PROCESSOR_SECRET` — slumpad sträng (delas mellan app och worker)

## Förändringar utanför appen (vi förbereder filerna åt dig)

### `worker/` (ny mapp i repot, deployas separat)
- `Dockerfile` — Node 22 + `ffmpeg` + `ffprobe`.
- `server.ts` — Bun/Node HTTP-server med en endpoint:
  - `POST /process` validerar HMAC, kör asynkront i bakgrund: ladda ner, ffprobe, pass 1 loudnorm-mätning, pass 2 FLAC + AAC, ladda upp via Supabase service-role, callback.
- `ffmpeg`-kommandon (förenklat):
  ```bash
  # Pass 1 — mät
  ffmpeg -i in -af loudnorm=I=-23:TP=-1:LRA=11:print_format=json -f null -

  # Pass 2 — FLAC med embedded metadata
  ffmpeg -i in -af "loudnorm=I=-23:TP=-1:LRA=11:measured_I=...:measured_TP=...:measured_LRA=...:measured_thresh=...:offset=...:linear=true:print_format=summary" \
    -c:a flac -compression_level 8 \
    -metadata title="..." -metadata artist="..." -metadata album="..." \
    -metadata track="..." -metadata date="..." -metadata genre="..." \
    -metadata ISRC="..." out.flac

  # Pass 2 — AAC 128k web
  ffmpeg -i in -af "loudnorm=...samma som ovan..." -c:a aac -b:a 128k -movflags +faststart out.m4a
  ```
- README med deploy-instruktioner för **Cloudflare Containers** (rekommenderat), Fly.io och Railway.

## Lagringsstruktur
```text
audio/
  <ownerId>/
    original/<submissionId>.<ext>     # oförändrad upload (behåll)
    master/<submissionId>.flac        # EBU R128 + metadata
    web/<submissionId>.m4a            # AAC 128k web playback
```

## Säkerhet & robusthet
- HMAC-signering åt båda håll (app→worker och worker→app callback).
- Worker laddar ner via tidsbegränsad signed URL (1 h).
- Idempotent: workern hoppar över om `master/<id>.flac` redan finns och `force !== true`.
- Vid fel: `processing_status='failed'` + `processing_error`. Admin-knapp för retry.
- Storleksgräns på inkommande fil (t.ex. 500 MB) för att skydda workern.

## Utanför scope
- Spelarens nedladdningsfunktion (vi kan addera "ladda ner master" senare).
- Mastering utöver loudnorm (ingen EQ, kompression, limiter utöver vad loudnorm gör).
- Hantering av Dolby Atmos-filer (`atmos_audio_path`) — lämnas orörda.

## Vad jag behöver från dig innan implementation
1. Bekräfta värd för worker (Cloudflare Containers / Fly.io / Railway / annat) — så jag kan skräddarsy README + ev. config.
2. När jag börjar bygga frågar jag efter `AUDIO_PROCESSOR_URL` och `AUDIO_PROCESSOR_SECRET` via en secret-prompt. Workern behöver vara deployad och URL:en känd innan vi kopplar in den i flödet (men du kan godkänna planen redan nu — vi bygger app-sidan och worker-koden parallellt och kopplar in URL:en sist).
