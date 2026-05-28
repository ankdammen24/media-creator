# Track-artwork: iTunes → Deezer → AI

Spegla artist-regenereringsflödet, men för låtar (submissions). Identifiera låtar där `artwork_path` är ett AzuraCast-importerat default (path innehåller `/azuracast/`) och försök hämta riktigt omslag via iTunes, sedan Deezer, sedan AI som sista utväg.

## Server (`src/lib/itunes.server.ts`)

Lägg till två nya verifierade sökningar — returnerar URL endast om både artist och låttitel matchar fuzzy:

- `searchTrackImageVerified(artistName, trackTitle)` — iTunes `entity=song`, plockar `artworkUrl100` från första matchande träff.
- `searchTrackImageDeezerVerified(artistName, trackTitle)` — Deezer `/search`, plockar `album.cover_xl/big/medium`.

(Återanvänder befintlig `fuzzyMatch` och `upscale`.)

## Server (`src/lib/ai-image.server.ts`)

Lägg till `generateTrackFallbackImage(artistName, trackTitle)` — samma mönster som `generateArtistFallbackImage` men prompten beskriver låten:
> "Abstract album-style square cover art inspired by the song '{title}' by '{artist}'. Minimalist, evocative, no faces, no text, no logos. 1:1 square."

## Server fn (`src/lib/artwork.functions.ts`)

Lägg till nytt bucket-uppladdningshelper `uploadAuto("tracks", id, url)` (lägg till `"tracks"` i folder-union för båda upload-helpers).

Ny server fn `bulkRegenerateTrackArtwork` (admin-only, mönstrad efter `bulkRegenerateArtistArtwork`):

1. Plocka `submissions` där `artwork_path ILIKE '%/azuracast/%'` (default-importerade), join `artist_profiles(name)`, limit 100 per körning.
2. Per rad:
   - iTunes verified på artist + låttitel → om träff, ladda upp, källa `itunes`.
   - Annars Deezer verified → källa `deezer`.
   - Annars AI fallback → källa `ai`.
3. Uppdatera `submissions.artwork_path` med nytt path.
4. Returnera `RegenerateResult`-liknande struktur (samma typ kan återanvändas).

Lägg också till `autoFetchTrackArtwork({ submissionId })` (single, ej admin-only — för per-låt-knapp i framtiden, valfritt nu men billigt att inkludera).

## UI (`src/components/AdminAutoArtwork.tsx`)

Lägg till en tredje sektion under existerande "Regenerera ALLA artistbilder":

- Titel: "Regenerera låt-omslag (AzuraCast-defaults)"
- Förklarar: hämtar från iTunes → Deezer → AI för låtar där bilden kommer från AzuraCast-importen. Max 100 per körning, skriver över.
- Confirm-dialog innan körning (samma mönster som artist-regen).
- Visar resultat med `bySource.itunes/deezer/ai/failed`-räknare.

Invalidera `["catalog"]` och relaterade query keys efter körning så preview uppdateras.

## Tekniska detaljer

- Inga DB-migrationer behövs.
- 150 ms sleep mellan rader för att vara snäll mot iTunes/Deezer.
- AI använder `LOVABLE_API_KEY` (samma som artist-fallback) — om saknas hoppas AI-steget tyst över och raden räknas som `failed`.
- Detektion av "default-bild" sker via path-pattern `%/azuracast/%`. Om vi vill bredda kriteriet (t.ex. alla låtar oavsett bild) kan vi lägga in ett toggle senare.

## Filer som ändras

- `src/lib/itunes.server.ts` — två nya funktioner
- `src/lib/ai-image.server.ts` — en ny funktion
- `src/lib/artwork.functions.ts` — ny bulk + single server fn, utvidgat folder-union
- `src/components/AdminAutoArtwork.tsx` — ny sektion + knapp + resultatvy
