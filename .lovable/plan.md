# Mål
Få bort alla Radio Uppsala-default-bilder från katalogen genom att, för varje träffad låt/album, hämta omslag i denna prioritetsordning:

1. **iTunes / Apple Music** (verifierad sökning på artist + titel)
2. **Deezer** (verifierad)
3. **MusicBrainz / Cover Art Archive** (verifierad)
4. **AI-genererat** (Lovable AI fallback) – bara om inget öppet hittas

Redan AI-genererade omslag och redan korrekta öppna omslag rörs **inte** – sveptet kör bara på rader vars `artwork_path` ligger under `/azuracast/` (Radio Uppsala-defaulten). AI-uppladdade och iTunes/Deezer-hämtade omslag ligger på andra paths och filtreras därför bort automatiskt.

# Vad finns redan
- `bulkRegenerateTrackArtwork` i `src/lib/artwork.functions.ts` gör exakt detta för **låtar** (`submissions` där `artwork_path ilike '%/azuracast/%'`), batch om 100, med iTunes → Deezer → MusicBrainz → AI.
- Admin-knapp finns redan i `AdminAutoArtwork.tsx` ("Återskapa låt-omslag").

Det som saknas för att nå målet "bort med alla RU-bilder":

# Ändringar

### 1. Album-sweep för Radio Uppsala-importerade albums
Lägg till `bulkRegenerateAzuracastAlbumArtwork` i `src/lib/artwork.functions.ts` som speglar `bulkRegenerateTrackArtwork` men mot `albums.artwork_path ilike '%/azuracast/%'`. Använder en låt på albumet för verifierad sökning (samma logik som single-sweepet) och uppdaterar både albumets omslag och länkade tracks.

### 2. "Sweep alla" i admin-UI
I `AdminAutoArtwork.tsx`, lägg en ny sektion **"Ta bort Radio Uppsala-bilder"** med en knapp som loopar `bulkRegenerateTrackArtwork` + det nya album-sveptet tills `scanned === 0` (eller max 20 batchar à 100 = 2000 rader per körning, för att skydda mot runaway). Visar löpande summering: behandlade, per källa (iTunes/Deezer/MusicBrainz/AI), misslyckade.

### 3. Liten justering: större default-limit
Höj default `limit` i `bulkRegenerateTrackArtwork` från 100 → 200 så varje batch är effektivare (request-tiden domineras ändå av externa API-anrop med 200 ms sleep mellan).

# Vad som INTE ändras
- AI-fallback-logiken (`generateTrackFallbackImage`) — oförändrad.
- Filtret `/azuracast/` säkerställer att redan AI-genererade eller iTunes-hämtade omslag inte rörs (de ligger på andra storage-paths).
- Inga DB-migrations behövs.

# Filer som rörs
- `src/lib/artwork.functions.ts` (ny export + limit-justering)
- `src/components/AdminAutoArtwork.tsx` (ny knapp + sweep-loop)
