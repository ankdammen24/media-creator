
## Mål

En-gångs synk av alla musik-spår från `stream.radiouppsala.se` (AzuraCast station 1) in i Media Rosenqvist-katalogen. Efter synk är denna katalog master — varje rad är en helt vanlig `submissions`-rad med status `approved`, kopplad till en `artist_profiles`-rad, och MP3:n ligger i `audio`-bucketen här. Inget beroende av AzuraCast kvar.

## Källa & filter

- API: `GET https://stream.radiouppsala.se/api/station/1/files` med `X-API-Key`.
- Hämtar MP3 via `links.download` (eller `/file/{id}/download` om download saknas).
- Hoppar över:
  - allt som inte är musik (samma `categoryFor()` som RU — path/genre innehåller `program`/`intervju`/`arkiv`).
  - filer < 40 s (jinglar/FX).
  - filer som redan importerats (idempotency på `azuracast_unique_id`, se schema nedan).

## Dataflöde per fil

1. Slå upp/auto-skapa `artist_profiles` baserat på `file.artist` (case-insensitivt; tom artist → "Okänd artist"). Ägare = den admin som triggade synken.
2. Ladda ner MP3 från AzuraCast.
3. Ladda upp till Supabase Storage:
   - `audio/{admin_user_id}/azuracast/{azId}.mp3` (privat bucket, signed URL — samma mönster som vanlig upload).
   - Omslag (`file.art`) laddas ner och läggs i `artwork/{admin_user_id}/azuracast/{azId}.jpg` (publik). Saknas → ingen artwork (admin kan lägga till efter).
4. Insert i `submissions`:
   - `media_type = 'music'`, `status = 'approved'`, `approved_at = now()`, `approved_by = admin_user_id`
   - `title = file.title || filnamn`, `description = null`
   - `user_id = admin_user_id`, `artist_profile_id = matchad/skapad profil`
   - `audio_path`, `artwork_path` enligt ovan
   - `azuracast_unique_id = file.unique_id` (för idempotency)

Då fungerar uppspelning direkt via befintlig `/catalog`-kod (`createSignedUrl(audio_path)`), och både artist och admin kan editera/ta bort precis som med vanliga submissions (RLS är redan på plats).

## Schema-tillägg

Liten migration:
- `ALTER TABLE submissions ADD COLUMN azuracast_unique_id text` + `CREATE UNIQUE INDEX ... WHERE azuracast_unique_id IS NOT NULL`.

(Inget mer — `submissions`/`artist_profiles` täcker resten.)

## Kod

- `src/lib/azuracast-import.server.ts` — själva arbetet. Iterativ loop: lista files, för varje musikspår: kontrollera idempotency, hämta fil via `fetch()`, `storage.upload()`, skapa profil om saknas, insert submission. Loggar `inserted/skipped/failed` och returnerar sammanställning. Använder `supabaseAdmin` (service_role) så RLS inte stör massimporten.
- `src/lib/azuracast-import.functions.ts` — `runAzuracastImport` server-fn skyddad med `requireSupabaseAuth` + admin-check. Tar valfri `dryRun: boolean`. Kör synkront (svarar när klart — inget bakgrundsjobb-system behövs för ett en-gångs-jobb), med kort timeout-marginal genom att processa i batcher.
- Admin-panelens befintliga tabbar (`/admin`) får en ny tab "Importera Radio Uppsala" med:
  - knapp "Förhandsvisa" (`dryRun: true` → visar antal som skulle importeras/hoppas över)
  - knapp "Kör import" (visar progress via löpande sammanställning från svaret)
  - efter klar: länk till `/catalog`.

## Secret

- `AZURACAST_API_KEY` — du lägger in den efter godkänd plan via `add_secret`.

## Risk & säkerhet

- Hela bygget bakom admin-roll + service_role, ingen publik endpoint.
- Idempotent: kan köras igen utan dubbletter (unique index).
- Om ett spår failar (404, storage-fel) hoppar vi över det och fortsätter; sammanställning visar listan.
- Worker-runtime: nedladdning + upload till storage går via `fetch` + `supabase.storage.upload(Blob)` — inga Node-only beroenden.

## Verifiering efter körning

- `/catalog` visar de importerade spåren med artwork.
- Klick → ljudet spelar (signed URL från `audio`-bucket).
- `/admin` → tab Artists visar alla auto-skapade profiler (kan döpas om/flyttas).
- Båda artist (om du flyttar äganderätten) och admin kan redigera/radera varje submission.
