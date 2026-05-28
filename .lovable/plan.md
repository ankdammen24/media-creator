## Mål

Introducera **Album** som en förstaklass-entitet: varje musik-submission måste tillhöra ett album (även singlar), album har egen artwork, beskrivning, releasedatum, typ och genre, och kan skapas av artist- eller admin-användare. Poddar berörs ej.

## Datamodell

Ny tabell `albums`:
- `id`, `user_id` (ägare), `artist_profile_id` (en artist per album)
- `title`, `description`, `release_date` (date, nullable)
- `album_type` enum: `album` | `ep` | `single` | `compilation`
- `genre` (text, nullable, fritext tills vidare)
- `artwork_path` (storage-path i `artwork`-bucket, nullable — får då ärva sitt första spårs artwork i UI:t)
- `created_at`, `updated_at`

Ändring av `submissions`:
- Ny kolumn `album_id uuid` — **obligatorisk för `media_type='music'`**, måste vara `NULL` för `media_type='podcast'` (CHECK-villkor).
- Ny kolumn `track_number int` — obligatorisk för musik, NULL för podd.
- UNIQUE(`album_id`, `track_number`) så ordningen är entydig.
- Constraint: `submissions.artist_profile_id` på musik måste matcha `albums.artist_profile_id` (valideras i app-lager + trigger).

RLS för `albums`:
- Publik SELECT (album är bara en container; sp ren styr exponering, men för att kunna lista album behöver de vara läsbara).
- INSERT/UPDATE/DELETE: ägare (`auth.uid() = user_id`) eller admin.
- Artist-koppling: precis som `submissions` — `artist_profile_id` måste ägas av användaren vid insert.

Migration backfillar befintliga musiksp r:
- För varje befintlig musik-submission utan album, skapa ett `single`-album med samma titel/artist/artwork, sätt `album_id` och `track_number=1`. Därefter sätts kolumnerna NOT NULL för musik via CHECK.

## UI-flöden

**1. Albumhantering (ny route `/albums/new` och `/albums/$albumId/edit`)**
- Formulär: titel, artist (dropdown över egna artist-profiler, admin ser alla), beskrivning, releasedatum, typ, genre, artwork-uppladdning.
- Knapp "Skapa album" i `/upload`-sidan och i artist-profilen.
- Admin- och artistägare kan redigera/radera album (radering blockeras om album har sp r — be användaren ta bort sp ren först).

**2. `/upload.tsx` (musik-läge)**
- Ny obligatorisk dropdown "Album" som listar användarens album för vald artist + "+ Skapa nytt album"-länk (öppnar `/albums/new?returnTo=/upload`).
- Nytt fält "Spårnummer" (auto-föreslår nästa lediga nummer i albumet).
- För podd: ingen album-väljare (oförändrat).
- `upload-batch.tsx` får samma album-väljare och auto-inkrementerande spårnummer per fil.

**3. Album-detaljsida (ny route `/albums/$albumId`)**
- Visar artwork, titel, artist, beskrivning, typ, releasedatum, genre.
- Spårlista (endast `approved`-spår för allmänheten; ägare/admin ser även pending/rejected) sorterad på `track_number`, med inline `PlayButton`.
- "Spela hela albumet"-knapp (sätter första sp ret i global player; köhantering ligger utanför scope).

**4. Katalog och artistsida**
- `/catalog.tsx`: lägg till filter "Album" + visningsläge som grupperar musik per album.
- `/artists/$artistId.tsx`: ny sektion "Album" ovanför sp rlistan, med kort som länkar till `/albums/$albumId`.
- `/index.tsx`: lägg till sektion "Nyaste album" (4–6 senaste album som har minst ett approved-spår).

**5. Mina submissions (`/my-submissions.tsx`)**
- Ny flik/sektion "Mina album" med skapa/redigera/radera.

## Kod-/filändringar

Nya filer:
- `src/routes/albums.new.tsx`, `src/routes/albums.$albumId.tsx`, `src/routes/albums.$albumId.edit.tsx`
- `src/components/AlbumForm.tsx` (delas av new/edit)
- `src/components/AlbumPicker.tsx` (dropdown + "skapa nytt"-länk för upload-flödena)
- Migration `…_albums.sql`

Ändrade filer:
- `src/routes/upload.tsx`, `src/routes/upload-batch.tsx` — album-picker + track_number
- `src/routes/catalog.tsx` — album-filter, "visa per album"
- `src/routes/artists.$artistId.tsx` — album-sektion
- `src/routes/index.tsx` — "Nyaste album"-sektion
- `src/routes/my-submissions.tsx` — egna album
- `src/routes/admin.tsx` — admin ser alla album, kan redigera/radera
- `src/components/GlobalSearch.tsx` — sök även i `albums.title`

## Granskning

Inget nytt admin-flöde för album: de blir publikt synliga så fort de finns, men dyker upp i katalog/hero först när minst ett spår är `approved`. Admin kan fortfarande dölja ett album genom att radera det eller dess sp r.

## Utanför scope

- Album-status/granskning (du valde "endast sp r granskas").
- Podd-grupperingar (shows/säsonger).
- Spellistor och kö i global player.
- Fördefinierade genrer / multi-genre — fritext räcker tills vidare.

## Sammanfattning av "vad mer är logiskt"

Utöver dina val har jag lagt till: `track_number` med UNIQUE per album, backfill-migration för befintliga sp r, konsistens-check så album-artist matchar sp r-artist, album-sektion på hem-/artist-/katalog-sidor, och album i global sökning. Säg till om något ska tas bort eller läggas till innan jag bygger.