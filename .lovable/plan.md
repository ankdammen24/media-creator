# AI-bildgenerering för EPK (etapp 1.5)

Bygger ovanpå `artist_images` från förra etappen. Inga DB-ändringar krävs — AI-genererade bilder lagras i samma tabell med `credit: 'AI-genererad'`.

## Tre integrationer

### 1. Generera EPK-bild från prompt (i `ArtistImageManager`)

Ny knapp **"Skapa med AI"** bredvid uppladdningsfältet. Öppnar en modal:
- Fritextfält för prompt (förifyllt mallförslag baserat på vald `kind`, t.ex. *"Studio-pressbild av artist Acme, naturligt ljus, bokeh, 4:3"*)
- Val av typ (avatar/cover/press) – styr aspect ratio (1:1 / 16:9 / 3:2)
- Streamad förhandsvisning med blur på partials (sells "renderar nu"), skarp på final
- "Spara till galleri" knapp → laddar upp PNG till `artwork`-bucket, infogar `artist_images`-rad med vald `kind`, `credit = 'AI-genererad (Gemini 3.1 Flash)'`, `visibility = 'link_only'` som default så artisten medvetet publicerar

### 2. Fallback i auto-fetch (artist + album)

I `AdminAutoArtwork.tsx` (befintlig admin-flik): efter iTunes-bulk visas summering "X hittades, Y saknas fortfarande". Ny knapp **"Generera resterande med AI"** som loopar de saknade och skapar bilder via samma server-route. Räknare visar uppskattad kostnad innan körning (`antal × ~$0.035`). Bekräftelse krävs.

I `AlbumForm.tsx` och `upload.tsx` när användaren skapar ny artist/album utan bild: efter att iTunes-auto-fetch misslyckats (idag tyst), erbjud en toast med knapp "Skapa AI-bild istället".

### 3. Redigera befintlig bild med AI

I `ArtistImageManager`-galleriet, ny knapp per bild **"Variera med AI"** (penselikon). Öppnar samma modal förifyllt med befintlig bild som referens + prompt-fält ("ändra bakgrund till studio", "gör mer dramatisk belysning", etc.). Använder Gemini-redigeringsläge (skickar bilden som input).

## Standardmodell och kostnad

- Default: **`google/gemini-3.1-flash-image-preview`** (Nano Banana 2) – ~$0.03–0.04/bild
- Kostnaden visas i UI:t bredvid generera-knappen så artisten ser innan klick
- Modellval exponeras inte i UI:t i denna etapp (kan läggas till senare om behov uppstår)

## Säkerhet och kreditskydd

- Server-route kräver inloggad användare via `requireSupabaseAuth`-mönster (manuell kontroll i routen eftersom det är en server-route, inte server-fn)
- Validerar att `auth.uid()` antingen äger `artist_profile_id` eller är admin (`has_role`)
- Endast ägare/admin ser AI-knappar i UI:t (samma `canEdit`-villkor som befintlig editor)
- Ingen dygnsgräns initialt (valt av användaren)
- Prompt loggas i `console.log` på servern för felsökning men sparas inte i DB

## Teknisk struktur

**Ny server-route** `src/routes/api/generate-artist-image.ts`:
- POST med `{ artistId, prompt, kind, referenceImagePath? }`
- Verifierar auth via Supabase access token i `Authorization`-header
- Verifierar ägarskap via `supabaseAdmin` SQL-fråga
- Anropar `https://ai.gateway.lovable.dev/v1/images/generations` med Gemini-shape (`messages` + `modalities: ["image", "text"]`), `stream: true`
- Skickar vidare upstream-SSE-body direkt till klienten (ingen buffering)
- Felhantering: 402 → "Lägg till credits i workspace", 429 → "Försök igen om en stund", 4xx → visa upstream-fel

**Ny komponent** `src/components/AiImageGenerator.tsx`:
- Modal med prompt, typ-val, streamad preview
- `eventsource-parser` för SSE (lägg till som dependency)
- `flushSync` runt setState så partial frames renderas progressivt
- Vid final: konvertera base64 → Blob → upload till storage → insert till `artist_images`

**Uppdateringar**:
- `ArtistImageManager.tsx`: lägg till "Skapa med AI"-knapp + "Variera"-knapp per bild
- `AdminAutoArtwork.tsx`: lägg till AI-fallback-knapp efter iTunes-körning, för både artister och album
- `AlbumForm.tsx` / `upload.tsx`: visa toast med "Skapa AI-bild" om iTunes misslyckas (mjuk integration, ingen blockering)

**Ny dependency**: `eventsource-parser` (~4 kB, Vercel-underhållen, behövs för SSE-parsning på klienten)

## Vad jag INTE gör nu

- Ingen dygnsgräns (kan läggas till om missbruk uppstår)
- Inget modellval i UI:t (default Gemini 3.1 Flash Image)
- Ingen separat AI-historik/audit-tabell (sparas som vanliga `artist_images` med credit-fält)
- Ingen automatisk AI utan klick (kreditkontroll alltid via knapptryck)

Säg till om något ska justeras innan jag bygger.
