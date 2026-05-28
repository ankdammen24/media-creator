## Mål

Edit-knappen på album-sidan ska öppna en fungerande redigeringsvy där man kan ändra metadata **och** ladda upp / AI-generera album-bild i efterhand. Samma stöd ska finnas för enskilda låtar (det finns redan i `EditSubmissionDialog`, vi verifierar bara).

## Diagnos

- `src/routes/albums.$albumId.tsx` länkar Edit-knappen till `/albums/$albumId/edit` via `<Link>`.
- Route-filen `src/routes/albums.$albumId.edit.tsx` finns och renderar `<AlbumForm existing={...} />`.
- `AlbumForm` innehåller redan både filuppladdning (Choose / Replace) **och** "Skapa med AI"-knapp (`AiArtworkDialog`).
- Att "inget händer" vid klick tyder på att navigationen via `<Link>` inte triggas i den här vyn (t.ex. event som inte propagerar, eller route-resolution som tyst misslyckas). Säkraste fixet: byt navigationsbeteende till en **inline-dialog**, samma mönster som `EditSubmissionDialog` använder för låtar. Då behöver vi inte felsöka router-beteendet och får ett mer konsekvent UX.

## Ändringar

### 1. Ny komponent: `EditAlbumDialog`

Skapa `src/components/EditAlbumDialog.tsx`:
- Modal (fixed overlay) i samma stil som `EditSubmissionDialog`.
- Innehåller `<AlbumForm existing={album} onSaved={...} />` så vi återanvänder all logik (titel, beskrivning, typ, genre, release date, artwork-upload, AI-generering).
- `onSaved` stänger dialogen och invaliderar `["album", albumId]`-queryn så vyn uppdateras direkt.

### 2. Album-sidan använder dialog istället för navigation

I `src/routes/albums.$albumId.tsx`:
- Ersätt `<Link to="/albums/$albumId/edit">` med en `<button>` som sätter `editingAlbumOpen = true`.
- Rendera `<EditAlbumDialog>` när öppet.
- Behåll route-filen `albums.$albumId.edit.tsx` för djuplänkar (kan vara kvar oförändrad).

### 3. Verifiera låt-redigering

`EditSubmissionDialog` (`src/components/SubmissionActions.tsx`) har redan "Replace artwork" + "Skapa med AI" via `AiArtworkDialog`. Ingen ändring krävs — vi bekräftar bara i UI-test efter bygget.

## Berörda filer

- `src/components/EditAlbumDialog.tsx` (ny)
- `src/routes/albums.$albumId.tsx` (Edit-knapp → öppnar dialog)

## Out of scope

- Ingen ändring av `AlbumForm`, `AiArtworkDialog`, `EditSubmissionDialog` eller server-funktioner.
- Inga databas- eller storage-ändringar.
