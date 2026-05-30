## Vad jag hittade

**1. Artistnamn saknas i Statistik-tabellen.** `getArtistStats` hämtar bara `title`, `albums(title)` osv. — inte artistprofilen. I tabellen syns därför bara låttitel, album och siffror.

**2. Spinns importeras men matchar 0 spår — fel id-fält.**
- Senaste cron-körningen lyckades (status `ok`, inga 500-fel). Tidsformatet är fixat.
- Men `spins_inserted = 0`. Orsaken syns när man jämför id-formaten:
  - AzuraCast `/history` returnerar `song.id` = **32-tecken MD5-hash** (t.ex. `36757c6a781e29aeb08570eeea53acd6`) — en hash av artist + titel + album.
  - I `submissions.azuracast_unique_id` har vi sparat **AzuraCast-filens `unique_id`** = 24 tecken (t.ex. `04924e7190925991e940edd4`).
  - Dessa är två olika identifierare i AzuraCast. `radio-spins-import` försöker matcha `song.id` mot `azuracast_unique_id` → 0 träffar, allt hamnar som "unmatched".

Det är därför inga spelningar dyker upp i statistiken trots att importen "körs felfritt".

## Plan

### A. Visa artistnamn på Statistik

1. `src/lib/stats.functions.ts` — utöka submissions-select med `artist_profiles!submissions_artist_profile_id_fkey(id, name)` och lägg till `artistName` i `ArtistStatRow`. (Behövs eftersom admin-kontot ser flera artister, och även för enskilda artister är det tydligare.)
2. `src/routes/stats.tsx` — ny kolumn "Artist" före titel-kolumnen, med översättningsnyckel `stats.artist`.
3. Lägg till `stats.artist` i alla 6 i18n-filer (`sv/en/no/da/fi/is`).

### B. Fixa AzuraCast-matchning så spinns landar

1. Lägg till kolumnen `azuracast_song_id text` på `submissions` (migration + index). Vi behåller `azuracast_unique_id` för existerande sync-logik.
2. `src/lib/azuracast-import.server.ts` — vid import av varje fil, spara även `song_id` (kommer från `file.song.id` i AzuraCast-files-API:t) i nya kolumnen.
3. Lägg till engångs-backfill i samma import-funktion: för befintliga submissions som har `azuracast_unique_id` men saknar `azuracast_song_id`, hämta `song.id` från den redan inhämtade filen och uppdatera raden. Då slipper användaren göra någon manuell åtgärd.
4. `src/lib/radio-spins-import.server.ts` — matcha `history.song.id` mot `azuracast_song_id` istället för `azuracast_unique_id`. Behåll fallback på `azuracast_unique_id` ifall någon rad ännu inte har hashen.
5. Efter att användaren kör "Synka från AzuraCast" en gång (för backfill) och sedan "Kör spelhistorik-import nu" ska `spins_inserted > 0` och Statistik visa radiosiffror.

### Tekniska detaljer

- Migrationen är liten: `ALTER TABLE public.submissions ADD COLUMN azuracast_song_id text; CREATE INDEX ...`. Ingen RLS-ändring (raden är redan skyddad).
- Inga ändringar i `playback_events` — den lagrar redan `azuracast_song_id` per spinn.
- UI: enbart tabellförändring på `/stats`, ingen layoutomstöpning.
