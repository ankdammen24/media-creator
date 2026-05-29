## Mål

Katalogen (`catalog.crystalpierrecords.org`) ska vara master för **musik** på AzuraCast (`stream.radiouppsala.se`, station 1). Allt godkänt musik-`submission` speglas till AzuraCast-mappen `Synced_music/`. Filer som ligger i `Synced_music/` men saknas i katalogen tas bort. Jinglar/SFX och andra mappar lämnas helt orörda.

## Speglingsregler

- **Källa:** `submissions` där `status = 'approved'` och `media_type = 'music'`.
- **Mål-mapp i AzuraCast:** `Synced_music/` (skapas vid första push om den inte finns).
- **Spellista:** alla nya filer kopplas till spellistan `default`.
- **Identitet/dedupp:** submission-`id` läggs in i filnamnet, t.ex. `Synced_music/{submission_id}__{artist}__{title}.{ext}`. Submission-`id` är källan till sanningen vid dubbletts-/raderingsbeslut — inte ISRC eller titel.
- **Skyddszon:** synken läser bara filer vars `path` börjar med `Synced_music/`. Allt utanför den prefixen ignoreras (jinglar, manuella uppladdningar, gamla importer).
- **Säkerhetsspärr:** om diff:en skulle radera mer än 30 % av filerna i `Synced_music/` i en körning, avbryt rensningen, logga och notifiera — pusha bara nya.

## Komponenter

1. **`src/lib/azuracast-sync.server.ts`** (ny) — AzuraCast-klient + sync-kärna:
   - `listSyncedFiles()` → `GET /api/station/1/files` filtrerad på prefix `Synced_music/`.
   - `uploadTrack(submission)` → laddar ned audio från Supabase Storage (`audio_web_path` föredras, annars `audio_path`) och `POST /api/station/1/files` med base64-body, path `Synced_music/{id}__{slug}.{ext}`, sätter metadata (title, artist, album, ISRC).
   - `assignToDefaultPlaylist(fileId)` → lägger filen i spellistan `default` (slår upp playlist-id en gång och cachar).
   - `deleteFile(fileId)` → `DELETE /api/station/1/file/{id}`.
   - `syncCatalogToAzuracast({ dryRun }) → { uploaded, deleted, skipped, failures }` — den fullständiga diff:en.

2. **`src/lib/azuracast-sync.functions.ts`** (ny) — `createServerFn` `runAzuracastSync` med admin-guard som kör kärnan; returnerar summary.

3. **`src/routes/api/public/hooks/sync-azuracast.ts`** (ny) — webhook för `pg_cron` (verifierar `apikey`-header mot anon-nyckeln), kör samma kärna.

4. **Push vid approve** — i den befintliga approve-flödet (submissions-update till `approved`) trigga `uploadTrack` + playlist-koppling direkt, så låten är på AzuraCast inom sekunder. Cron används enbart för catch-up och rensning.

5. **`/admin/tracks`** — knapp **"Sync to AzuraCast"** som kör `runAzuracastSync` manuellt och visar summary-toast.

6. **Cron** — `pg_cron`-jobb var 15:e minut som anropar `/api/public/hooks/sync-azuracast`.

7. **DB-fält på `submissions`** (migration):
   - `azuracast_file_id integer null` — AzuraCast-filens id efter lyckad upload.
   - `azuracast_synced_at timestamptz null` — senaste lyckade push.
   - `azuracast_sync_error text null` — senaste felmeddelande för admin-UI.
   (Inga RLS-ändringar; befintliga policies täcker dessa kolumner.)

## Tekniska noter

- AzuraCast-API: `X-API-Key: AZURACAST_API_KEY` (finns redan som secret). Bas-URL och station-id återanvänds från `azuracast-import.server.ts` (`stream.radiouppsala.se`, station 1).
- Audio hämtas från privata `audio`-bucketen via `supabaseAdmin.storage.from('audio').createSignedUrl(...)`, sedan streamas in i base64 för AzuraCast-uppladdningen (AzuraCast-API kräver base64 i `POST /files`).
- Inga ändringar på den befintliga "pull from catalog"-syncen behövs — riktningen som etableras nu är ren push.
- Allt körs i TanStack server-funktioner / server-routes; inga edge functions.

## Verifiering efter implementation

1. Kör manuell sync via `/admin/tracks` mot ett tomt `Synced_music/` — bekräfta att alla approved music-submissions laddas upp och hamnar i playlistan `default`.
2. Markera ett submission som `rejected` (eller ta bort) — kör syncen igen och bekräfta att motsvarande fil raderas.
3. Lägg en manuell jingel i en annan AzuraCast-mapp — bekräfta att den ligger kvar.
4. Godkänn ett nytt submission och bekräfta att det dyker upp inom sekunder utan att vänta på cron.
