# Spegla musik från catalog → AzuraCast

`catalog.crystalpierrecords.org` blir master. Endast musik (godkända submissions) synkas till AzuraCast-mappen `Synced_music/` och läggs i spellistan `default`. Jinglar och andra filer i AzuraCast lämnas orörda.

## Trigger
- **Direkt push** när en submission sätts till `approved` (sker i admin-flödet).
- **Cron var 15:e min** som catch-up + cleanup (raderar i `Synced_music/` det som inte längre är `approved` i katalogen, fyller på det som saknas).
- **Manuell knapp** "Sync to AzuraCast" i `/admin/tracks` för full re-sync på begäran.

## Komponenter

1. **DB-migration** — nya kolumner på `submissions`:
   - `azuracast_file_id` (text, nullable)
   - `azuracast_synced_at` (timestamptz, nullable)
   - `azuracast_sync_error` (text, nullable)

2. **`src/lib/azuracast-sync.server.ts`** (ny) — kärnan:
   - `listSyncedFiles()` — `GET /station/1/files` filtrerat på `path LIKE 'Synced_music/%'`
   - `uploadTrack(submission)` — hämtar audio via signed URL från Supabase `audio`-bucket, laddar upp som base64 till `POST /station/1/files` med path `Synced_music/<submission_id>.<ext>`
   - `assignToDefaultPlaylist(fileId)` — sätter playlist via `POST /station/1/file/{id}`
   - `deleteFile(fileId)` — `DELETE /station/1/file/{id}`
   - `syncCatalogToAzuracast()` — diff mellan godkända submissions och `Synced_music/`-innehåll; säkerhetströskel: avbryt om >30% skulle raderas

3. **`src/lib/azuracast-sync.functions.ts`** (ny) — `createServerFn`:
   - `pushSubmissionToAzuracast({ submissionId })` — admin-guard, används både från approve-flödet och knappen
   - `runAzuracastFullSync()` — admin-guard, anropar `syncCatalogToAzuracast()`

4. **Approve-flödet** (befintlig server fn för submission-status) — efter `approved`-uppdatering, anropa `pushSubmissionToAzuracast` i bakgrunden (fire-and-forget med felfångst → skriver `azuracast_sync_error`). Misslyckas pushen blockerar det INTE approven; cron fångar upp senare.

5. **`src/routes/api/public/hooks/sync-azuracast.ts`** (ny) — POST-endpoint för `pg_cron`, anropar `syncCatalogToAzuracast()`. Skyddad via `apikey`-header (anon key).

6. **pg_cron-jobb** — var 15:e minut, anropar webhooken med stabil URL `project--8df07df4-...lovable.app/api/public/hooks/sync-azuracast`.

7. **`/admin/tracks`** — ny "Sync to AzuraCast"-knapp ovanför listan, toast med summary (uppladdade / borttagna / fel).

## Verifiering
1. Skapa mappen `Synced_music/` i AzuraCast och verifiera att spellistan heter `default`.
2. Tryck "Sync to AzuraCast" en gång för full initial spegling.
3. Approve en ny submission → ska dyka upp i `Synced_music/` inom sekunder och vara med i `default`.
4. Sätt en submission till `rejected` → filen ska försvinna vid nästa cron-run.
5. Lägg manuellt en jingle i annan AzuraCast-mapp → ska aldrig röras.

## Tekniska detaljer
- AzuraCast API: `https://stream.radiouppsala.se/api`, station id `1`, header `X-API-Key: ${AZURACAST_API_KEY}` (secret finns redan).
- Filuppladdning: base64-kodad body till `POST /station/{id}/files` med `{ path, file }`.
- Supabase storage: hämtar via signed URL (privat `audio`-bucket) eller direkt via `supabaseAdmin.storage.from('audio').download(...)`.
- Säkerhetströskel: om diff vill radera mer än 30% av nuvarande `Synced_music/`-innehåll, avbryt med fel och kräv manuell körning.
- Lovable AI eller andra AI-providers berörs inte.

**Att göra på AzuraCast-sidan innan körning:** skapa mappen `Synced_music/` och bekräfta att spellistan heter exakt `default` (matchas case-insensitive).