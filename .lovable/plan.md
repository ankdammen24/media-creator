## Mål
Möjliggöra drag-and-drop-omsortering av låtar inom ett album på albumsidan (`/albums/$albumId`). Användare med redigeringsrätt (ägare, admin eller artist-roll) ska kunna dra en låt upp/ner och ordningen sparas direkt i databasen via `submissions.track_number`.

## Förändringar

### 1. Nytt bibliotek
- Installera `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` (lättviktigt, fungerar bra med både mus och touch, tillgängligt).

### 2. Ny serverfunktion: `reorderAlbumTracks`
Plats: `src/lib/catalog-edit.functions.ts`
- Input: `{ albumId: string, orderedSubmissionIds: string[] }` (Zod-validerad).
- Skyddas med `requireSupabaseAuth`.
- Verifierar att användaren får redigera albumet (ägare via `albums.user_id`, eller har roll `admin`/`artist`).
- Verifierar att alla submission-id:n hör till albumet.
- Uppdaterar `track_number` i `submissions` för varje id enligt position (1-baserat), antingen via en loop eller en `CASE`-baserad batch-update.

### 3. UI: sorterbar tracklista i `src/routes/albums.$albumId.tsx`
- Ersätt `<ol>`-listan med en `DndContext` + `SortableContext` (strategi: `verticalListSortingStrategy`).
- Bryt ut varje låt-rad till en `SortableTrackRow`-komponent som använder `useSortable` — visar ett drag-handtag (GripVertical-ikon från lucide-react) längst till vänster, endast synligt när `canEdit` är true.
- Sensors: `PointerSensor` + `KeyboardSensor` (tillgänglighet), aktiveringsdistans ~5px så klick på Play/Edit-knappar inte triggar drag.
- Vid `onDragEnd`:
  1. Optimistiskt uppdatera lokal ordning + visa de nya `track_number` direkt.
  2. Anropa `reorderAlbumTracks` via `useServerFn`.
  3. Vid fel: rollback + toast. Vid lyckat: `queryClient.invalidateQueries(["album", albumId, ...])`.
- För användare utan redigeringsrätt: rendera samma lista men utan drag-handtag och utan DndContext-wrapping (eller med `disabled`).

### 4. Touch/mobil
Använd `TouchSensor` också med liten delay (150ms) så scroll inte krockar med drag på mobil.

## Tekniska detaljer

- Behörighet i serverfunktionen följer befintligt mönster i `catalog-edit.functions.ts` (samma kontroll som `attachSubmissionsToAlbum`).
- Inga DB-migrations behövs — `track_number` finns redan på `submissions` och RLS tillåter redan ägare/admin/artist att uppdatera.
- Behåll befintliga klick-targets (Play, Edit) genom att lägga drag-listeners endast på drag-handtaget (`{...listeners}` på handle-spannet, inte hela raden).

## Utanför scope
- Omsortering över flera album (drag-and-drop endast inom samma album).
- Bulk-omsortering via tangentbordsgenvägar utöver dnd-kits inbyggda (pil-upp/ner när handle har fokus).
