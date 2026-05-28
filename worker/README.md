# Audio Processing Worker

Producerar två varianter av varje låt:

- **FLAC-master** med inbäddad metadata, normaliserad enligt EBU R128 strikt (−23 LUFS / −1 dBTP / LRA 11).
- **AAC 128 kbps (.m4a)** för webbspelaren, samma loudness-target.

Workern tar emot jobb från Lovable-appen via `POST /process`, hämtar originalfilen via en tidsbegränsad signed URL från Supabase Storage, kör ffmpeg lokalt och laddar upp resultatet tillbaka till samma bucket. När jobbet är klart POSTar workern resultatet till app-endpointen `/api/public/hooks/audio-processed` med en HMAC-signatur.

## Krav på din VPS / container

- Linux med Docker (eller direkt Node 22 + `ffmpeg`/`ffprobe` installerat).
- Utgående HTTPS till `*.supabase.co` (för storage), till din app-domän (för callback) och till AzuraCast om importer går via den vägen.
- Inkommande HTTPS från Lovable-appen. Stäng resten av portarna eller sätt brandvägg.
- Minst 1 vCPU och ~1 GB RAM räcker för normala spår; större filer = mer CPU-tid.
- Lagring: bara temp-plats (`/tmp`) — workern raderar mellanfiler själv.

## Miljövariabler

| Namn | Beskrivning |
|---|---|
| `AUDIO_PROCESSOR_SECRET` | Delad HMAC-secret. **Måste** vara samma som i Lovable Cloud. |
| `SUPABASE_URL` | Din Supabase project URL (samma som appen). |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role-nyckel. **Hemlig** — committa aldrig. |
| `STORAGE_BUCKET` | Default `audio`. |
| `PORT` | Default `8080`. |
| `MAX_INPUT_BYTES` | Default `524288000` (500 MB). |

## Bygg och kör med Docker

```bash
cd worker
docker build -t media-audio-worker .

docker run -d --restart=always \
  --name media-audio-worker \
  -p 8080:8080 \
  -e AUDIO_PROCESSOR_SECRET="<samma som i Lovable Cloud>" \
  -e SUPABASE_URL="https://wcwspshvijwploekfpuo.supabase.co" \
  -e SUPABASE_SERVICE_ROLE_KEY="<service role key>" \
  media-audio-worker
```

Sätt sen en reverse proxy (Caddy, nginx, Traefik) framför port 8080 med ett TLS-cert, t.ex. `https://media-processor.dindomän.se`.

## Bygg och kör direkt med Node 22

```bash
cd worker
sudo apt-get install -y ffmpeg
npm install --omit=dev
AUDIO_PROCESSOR_SECRET=... \
SUPABASE_URL=... \
SUPABASE_SERVICE_ROLE_KEY=... \
node --experimental-strip-types server.ts
```

Lägg upp som systemd-tjänst för att starta automatiskt vid omstart.

## Koppla in i Lovable

När workern är nåbar på en HTTPS-URL:

1. Sätt secret i Lovable Cloud:
   - `AUDIO_PROCESSOR_URL` = t.ex. `https://media-processor.dindomän.se`
   - `AUDIO_PROCESSOR_SECRET` = samma sträng som workern kör med
2. (Valfritt) `PUBLIC_APP_URL` = `https://media-catalog.lovable.app` så worker når callback-endpointen även om jobbet startas via en preview-domän.
3. Gå till **Admin → Bearbetning** och tryck **Bakåtfyll** för att börja processa befintliga låtar 50 i taget.

## Endpoints

| Metod | Path | Beskrivning |
|---|---|---|
| `GET` | `/health` | Returnerar `{"ok":true}`. |
| `POST` | `/process` | Tar emot ett signerat jobb, returnerar `202 Accepted`, kör asynkront. |

## Felsökning

- **401 invalid signature** — HMAC-secret skiljer sig mellan app och worker.
- **download 404** — signed URL har gått ut (1 h) eller filen saknas i bucketen.
- **upload …: row violates RLS** — fel `SUPABASE_SERVICE_ROLE_KEY` (du har angett anon-key av misstag).
- Workern är **idempotent**: kör om samma jobb och den skriver bara över master+web-filerna.

## ffmpeg-kommandon (för referens)

```bash
# Pass 1 — mät
ffmpeg -i in -af loudnorm=I=-23:TP=-1:LRA=11:print_format=json -f null -

# Pass 2 — FLAC med embedded metadata
ffmpeg -i in -af "loudnorm=I=-23:TP=-1:LRA=11:measured_I=...:measured_TP=...:linear=true" \
  -c:a flac -compression_level 8 -metadata title="…" out.flac

# Pass 2 — AAC 128k web
ffmpeg -i in -af "loudnorm=…samma som ovan…" -c:a aac -b:a 128k -movflags +faststart out.m4a
```