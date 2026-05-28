## Mål

Lägg till en admin-åtgärd som hämtar **nya omslag för alla singlar** (releaser med typen *single*). Sökordning: iTunes/Apple → Deezer → MusicBrainz/Cover Art Archive. Hittas inget officiellt omslag genererar AI ett unikt abstrakt omslag. Både singelns albumomslag och dess låt-omslag uppdateras. Befintliga omslag skrivs över (alla singlar berörs).

Katalogen har idag 262 singlar, varav ~250 använder samma generiska AzuraCast-omslag – syftet är att ge varje single ett eget, varierat omslag.

## Ny gratis källa: MusicBrainz / Cover Art Archive

Ny serverhjälpare i `src/lib/itunes.server.ts`:

- `searchTrackImageCoverArtArchive(artistName, trackTitle)`:
  1. Slå upp inspelning/release via MusicBrainz (`https://musicbrainz.org/ws/2/release?query=...&fmt=json`), med en beskrivande `User-Agent` (krav från MusicBrainz).
  2. Verifiera artist + titel med samma fuzzy-matchning som redan finns.
  3. Hämta omslag från Cover Art Archive (`https://coverartarchive.org/release/{mbid}/front-500`). Returnera URL bara om bild finns.
- Helt gratis, ingen nyckel. Extra `sleep` läggs in mellan anrop (MusicBrainz tillåter ~1 req/s).

## Ny server-funktion (admin)

I `src/lib/artwork.functions.ts`, ny `bulkRegenerateSingleArtwork` (createServerFn, `requireSupabaseAuth`, admin-koll via befintliga `isAdmin`):

- Hämta album där `album_type = 'single'`, sorterade på `created_at`, `limit` (default 100, max 500).
- För varje single:
  - Hämta artistnamn (`artist_profiles.name`) och den/de kopplade `submissions` (titel används för verifiering; fallback = albumtiteln).
  - Försök i ordning: `searchTrackImageVerified` (iTunes) → `searchTrackImageDeezerVerified` → `searchTrackImageCoverArtArchive` → `generateTrackFallbackImage` (AI).
  - Ladda upp via befintliga `uploadAuto` / `uploadBlob` till `auto/albums/...`.
  - Uppdatera **`albums.artwork_path`** och **alla kopplade `submissions.artwork_path`** med samma sökväg.
- Returnera utökad `RegenerateResult` med en ny källa `musicbrainz` i `bySource`.

Typen `RegenerateSource` utökas: `"itunes" | "deezer" | "musicbrainz" | "ai" | "failed"` och `bySource` får fältet `musicbrainz`.

## UI

I `src/components/AdminAutoArtwork.tsx`:

- Nytt kort **"Regenerera singel-omslag"** med en knapp och en `window.confirm` som varnar att alla singlar skrivs över och att AI används som sista utväg (förbrukar credits).
- Lägg till `"singles"` i `busy`/`ResultState`-typerna och visa källan MusicBrainz i `renderSummary` (samt i den övriga regen-summeringen).
- Efter körning invalideras `["catalog"]` och `["admin-artists"]`.

## Tekniska detaljer

- Inga databasändringar behövs – endast uppdatering av befintliga `artwork_path`-fält via service-role-klienten på servern.
- Skrivningar sker med `supabaseAdmin` (kringgår RLS) men funktionen är admin-låst.
- Throttling: `sleep(~200ms)` mellan singlar, plus extra paus runt MusicBrainz-anropen.
- Körs i batchar (max 500) så långa kataloger kan betas av i omgångar; resultatlistan visar källa per single och ev. felorsak.
