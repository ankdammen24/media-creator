## Mål

Skapa nya bilder för **alla artister** och skriv över befintliga. Bilden hämtas bara från en källa om både artistnamnet OCH ett av artistens egna låtnamn (från `submissions`) verifieras i källans svar. Annars genereras en abstrakt, ansiktslös AI-bild.

## Sökflöde per artist

1. Hämta artistens godkända låtar (`submissions.title` där `artist_profile_id = artist.id`, max ~20 titlar).
2. **iTunes** (`itunes.apple.com/search`, entity `song`, term = `"<artist> <låt>"`). Itererar igenom låtarna tills en träff returnerar:
   - `artistName` ≈ artistens namn (case/diakritik-okänslig jämförelse), och
   - `trackName` ≈ någon av artistens låttitlar.
   Om träff: använd `artworkUrl100` upskalat till 1000×1000.
3. **Deezer-fallback** (`api.deezer.com/search?q=artist:"X" track:"Y"`). Samma verifiering på `artist.name` + `title`. Använd `album.cover_xl` (eller `cover_big`).
4. **AI-fallback** om varken iTunes eller Deezer ger verifierad träff: generera 1024×1024 via Lovable AI Gateway (`openai/gpt-image-2`, `quality: "low"`, non-streaming) med en abstrakt prompt baserad på artistens namn/genre — explicit "no faces, no people, no text".
5. Ladda upp resultatet till bucket `artwork` under `auto/artists/<id>-<ts>.{jpg|png}` och uppdatera `artist_profiles.avatar_path`. Loggas som källa: `itunes` / `deezer` / `ai` / `failed`.

## Ändringar

### `src/lib/itunes.server.ts`
- Lägg till `searchArtistImageVerified(artistName, songTitles[])` som söker per låt och returnerar URL endast om både artist + låt matchar.
- Lägg till `searchArtistImageDeezerVerified(artistName, songTitles[])` med samma kontrakt.
- Behåll befintliga overifierade funktioner för albumflödet.

### Ny fil `src/lib/ai-image.server.ts`
- `generateArtistFallbackImage(artistName: string): Promise<{ blob, contentType } | null>` som anropar AI Gateway `/v1/images/generations` (non-streaming), parsear `data[0].b64_json` och returnerar binärdata.

### `src/lib/artwork.functions.ts`
- Ny serverfunktion `bulkRegenerateArtistArtwork` (admin-only):
  - Hämta **alla** rader från `artist_profiles` (ej bara där `avatar_path is null`).
  - För varje artist: hämta sub­mission-titlar, kör flödet ovan, ladda upp, uppdatera `avatar_path`.
  - Returnera utökad `BulkResult` med `source: "itunes" | "deezer" | "ai" | "failed"` per post.
  - Liten paus (~150 ms) mellan poster för att undvika rate-limit.
- Behåller existerande `bulkFetchMissingArtistArtwork` orörd (används fortfarande för "endast saknade").

### `src/components/AdminAutoArtwork.tsx`
- Ny knapp "Regenerera ALLA artistbilder (skriver över)" med röd/varnings-styling och `confirm()`-dialog innan körning.
- Visar källfördelning i resultatet (iTunes / Deezer / AI / Misslyckade).

## Säkerhet & gränser

- Bulk-funktionen kräver admin (samma `isAdmin`-check som redan finns).
- AI-anrop kan kosta credits — varningstext i UI:t innan körningen startar.
- Default-batch: 100 artister per körning (parameter), så stora kataloger körs i omgångar.

## Tekniska detaljer

- Normaliserad jämförelse: `s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "")`. Träff om ena är substring av den andra.
- AI-prompt-mall: `"Abstract, artistic album-style square cover art inspired by the musical identity of '<artist>'. Minimalist, modern, evocative shapes and color. No faces, no people, no text, no logos. 1:1."`
- AI-modell: `openai/gpt-image-2`, `size: "1024x1024"`, `quality: "low"`, `n: 1`, `stream: false` (vi behöver bara den färdiga binären på servern).
