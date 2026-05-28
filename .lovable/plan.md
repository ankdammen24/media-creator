## Mål

Överallt där en inloggad användare (artist eller admin) kan ladda upp en bild ska det också finnas en knapp **"Skapa med AI"** som öppnar en streamande generator och lämnar tillbaka en färdig fil till det vanliga uppladdningsflödet. Inga nya rättigheter införs — knappen visas bara där användaren redan har rätt att ladda upp, så befintlig RLS + UI-gating räcker.

## Identifierade uppladdningsställen

| # | Plats | Bildtyp | Aspekt |
|---|---|---|---|
| 1 | `src/components/ArtistProfileEditor.tsx` | Artistens avatar | 1:1 |
| 2 | `src/components/AlbumForm.tsx` | Albumomslag | 1:1 |
| 3 | `src/components/SubmissionActions.tsx` (admin/ägar-byte) | Spår-omslag | 1:1 |
| 4 | `src/routes/upload.tsx` | Spår-omslag (single) | 1:1 |
| 5 | `src/routes/upload-batch.tsx` | Spår-omslag (per draft + delad) | 1:1 |
| 6 | `src/components/ArtistImageManager.tsx` | Artistgalleri — *redan klart via `AiImageGenerator`* | — |

## Lösning

### 1. Generisk server-route — `src/routes/api/generate-artwork.ts`

En förenklad, återanvändbar version av `generate-artist-image.ts`:

- `POST { prompt: string, aspect: "1:1" | "16:9" | "3:2" }`.
- Verifierar bara att anroparen är inloggad (samma `verifyUser`-mönster). Ingen ägar-/admin-koll — den görs av RLS när bilden sen laddas upp.
- Strömmar SSE från Lovable AI Gateway `/v1/images/generations` med `google/gemini-3.1-flash-image-preview` (samma modell + kostnadsprofil som befintlig generator).
- Skriver **inget** till databasen — returnerar bara strömmen.

### 2. Generisk klient-komponent — `src/components/AiArtworkDialog.tsx`

Modal med samma look som `AiImageGenerator`, men frikopplad från `artist_images`:

```ts
type Props = {
  open: boolean;
  defaultPrompt?: string;          // t.ex. "Albumomslag: {titel} av {artist}"
  aspect?: "1:1" | "16:9" | "3:2"; // default 1:1
  onClose: () => void;
  onGenerated: (file: File) => void; // PNG-fil till anroparen
};
```

- Återanvänder befintlig SSE-parser, `flushSync`-mönstret och blur-på-partial från `AiImageGenerator` (kopieras, ej delas, för att hålla diff:en lokal).
- "Använd bild"-knapp anropar `onGenerated(new File([blob], "ai-artwork.png", { type: "image/png" }))` och stänger modal.
- Anroparen sköter därefter sitt vanliga upload-flöde (Storage + DB-rad) precis som vid manuell filuppladdning.

### 3. Knapp + integration på varje ställe

Bredvid varje `<input type="file">` läggs en `<button>` med Sparkles-ikon "Skapa med AI". Klick → öppnar `<AiArtworkDialog>` med en lämplig default-prompt; `onGenerated` matar in filen i samma state-variabel som filinputen sätter (`setArtwork`, `setAvatarFile`, draftens `artwork`-fält osv).

Default-prompter (svenska, abstrakt/konstnärlig stil i linje med tidigare beslut):

- Avatar: `"Stiliserat, abstrakt porträttmotiv för musikartisten {artistName}, lugn färgpalett, inga ansikten, inga texter"`.
- Albumomslag: `"Abstrakt albumomslag för '{albumTitle}' av {artistName}, konstnärlig komposition, ingen text"`.
- Spår-omslag: `"Abstrakt omslag för låten '{trackTitle}' av {artistName}, konstnärligt motiv, ingen text"`.

Användaren kan redigera prompten i modalen innan generering.

### 4. Inga ändringar i

- `AiImageGenerator.tsx` / `/api/generate-artist-image` — fortsätter driva artistgalleriet (skriver direkt till `artist_images`).
- `bulkRegenerateArtistArtwork` och iTunes/Deezer-flöden.
- RLS-policies, tabeller eller buckets.

## Filer som ändras

- **Ny** `src/routes/api/generate-artwork.ts`
- **Ny** `src/components/AiArtworkDialog.tsx`
- **Ändras** `src/components/ArtistProfileEditor.tsx`
- **Ändras** `src/components/AlbumForm.tsx`
- **Ändras** `src/components/SubmissionActions.tsx`
- **Ändras** `src/routes/upload.tsx`
- **Ändras** `src/routes/upload-batch.tsx` (knapp både per draft och för delat omslag)

## Utelämnat medvetet

- Ingen separat backend-rättighetscheck per resurs — Storage/DB-skrivningen som redan finns kvar bakom RLS är det riktiga skyddet, så vi undviker att duplicera logiken i AI-endpointen.
- Inga nya tabeller/kolumner.
- Befintlig generator för artistgalleri rörs inte.
