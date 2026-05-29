
## Mål

Ge artister en egen statistiksida med antal play-klick, antal "riktiga" lyssningar (≥30 sek) och antal spelningar i Radio Uppsalas etersändning per låt/episod. Radio Uppsala-datan hämtas automatiskt en gång i veckan.

## 1. Databas

Ny tabell `playback_events` (rå händelselogg):
- `submission_id` (uuid, FK till submissions)
- `event_type` ('play' | 'completed_30s' | 'radio_spin')
- `user_id` (uuid, nullable — null = anonym besökare)
- `session_id` (text, anonym browser-session, för dedupe)
- `source` ('catalog' | 'album_page' | 'artist_page' | 'radio_uppsala')
- `occurred_at` (timestamptz)

Ny vy/materialiserad vy `submission_stats` som aggregerar per `submission_id`:
- `play_count`, `completed_count`, `radio_spin_count`, `last_played_at`

RLS:
- `playback_events`: INSERT öppet för anon+authenticated (med rate-limit i serverfn), SELECT endast för admin och ägaren av submission (via join).
- `submission_stats`: SELECT för admin + ägare.

Service-role används för radio-importen.

## 2. Loggning av klick (frontend → server)

- Ny serverfn `logPlaybackEvent({ submissionId, eventType, source })` som validerar input och skriver via `supabaseAdmin` (eftersom anon ska kunna logga utan att vi öppnar tabellen helt).
- `PlayButton` / `PlayerProvider`:
  - Skicka `play` direkt när uppspelning startar.
  - Sätt en 30-sekunders timer; om låten fortfarande spelas (ej pausad/bytt) skicka `completed_30s`. En händelse per (session, submission) per dygn för att undvika spam.
- Source härleds från sidan (`catalog`, `album_page`, `artist_page`).

## 3. Radio Uppsala-import (veckovis)

- Ny serverfn `importRadioUppsalaPlays` som:
  1. Hämtar AzuraCast play-historik (`/api/station/1/history?start=...&end=...`) för senaste 7 dygnen — paginerar tills tomt.
  2. Matchar varje uppspelad fil mot `submissions` via `azuracast_unique_id` (finns redan), fallback ISRC/UPC.
  3. Skriver en `radio_spin`-rad per spelning till `playback_events`.
  4. Idempotent: använd en hash av (azuracast_song_id + played_at) som unique key, eller spara `last_imported_at` i en liten `radio_import_runs`-tabell och importera bara nyare poster.
- Publik route `src/routes/api/public/hooks/import-radio-uppsala.ts` som anropar funktionen, skyddad via `apikey`-header (Supabase anon key).
- pg_cron-jobb varje måndag 04:00 (`0 4 * * 1`) som pingar route via `pg_net.http_post`.

## 4. Artist-UI

- Ny route `/_authenticated/stats` (svensk titel "Statistik") som listar artistens submissions med kolumner: titel, play-klick, 30s-lyssningar, radiospelningar, senaste spelning.
- Sortering/filter per artistprofil om användaren har flera artister.
- Liten KPI-rad överst: totalt antal klick / 30s / radio senaste 30 dagarna.
- Länk i `SiteHeader` för inloggade artister.
- Översätt allt via befintliga i18n-filer (`stats`-namespace, sv/en).

## 5. Säkerhet

- Rate-limit i `logPlaybackEvent` per session_id (max ~5 events/sekund).
- Validera att `submissionId` finns och har status `approved` innan radskrivning.
- Radio-importen endast nåbar via cron-secreten (anon-key + pg_cron).

## Teknik (kort)

```text
playback_events ──┐
                  ├─► submission_stats (vy)
radio_import_runs ┘
                          ▲
   Frontend Play/30s ─────┤  (serverFn logPlaybackEvent)
   pg_cron → /api/public/hooks/import-radio-uppsala ──► AzuraCast history → playback_events
```

Allt i18n-översatt (sv/en). Inga ändringar i befintliga upload-/release-flöden.
