## Mål

`/api/public/tracks` och `/api/public/tracks/:id` ska returnera ett `audio_url`-fält så att katalog-syncen (och andra konsumenter) får en spelbar URL. Audio-bucketen är privat, så vi exponerar en stabil proxy-URL istället för rå storage-path.

## Vad som ändras

1. **Ny endpoint `src/routes/api/public/stream.$id.ts`** (`/api/public/stream/:id`)
   - Slår upp submission via `supabaseAdmin` med `status = 'approved'`.
   - Väljer `audio_web_path` om finns, annars `audio_path`.
   - Skapar en signerad URL (kort TTL) mot `audio`-bucketen och svarar med `302`-redirect dit.
   - Vidarebefordrar `Range`-headern är inte nödvändigt eftersom redirect:en låter klienten prata direkt med Supabase Storage (som stödjer range).
   - Returnerar 404 om submission saknas/inte är approved eller saknar audio-path.
   - CORS via `PUBLIC_CORS` + `OPTIONS`-handler.

2. **`src/lib/api-projections.ts`**
   - Lägg till `audio_url: string | null` i `PublicTrack`.
   - Ny helper `streamUrl(id)` som returnerar absolut URL till `/api/public/stream/:id`. Base URL läses från `process.env.PUBLIC_SITE_URL` med fallback till `https://catalog.crystalpierrecords.org`.
   - `projectTrack` sätter `audio_url = streamUrl(row.id)` när `audio_web_path` eller `audio_path` finns, annars `null`.
   - Utöka `PUBLIC_TRACK_COLUMNS` med `audio_web_path, audio_path` så projektionen kan avgöra om audio finns (fälten själva läcker inte ut — de används bara för null-check).

3. **Sync-anpassning** (säkerhetscheck)
   - Bekräfta att `catalog-sync-core.server.ts` läser `audio_url` (inget kodbyte krävs om så är fallet — användaren har redan beskrivit att fältet plockas upp automatiskt).

## Säkerhetsnoter

- `audio_url` är en stabil proxy-URL; den signerade URL:en bakom genereras per request och har kort livslängd.
- Endast `approved` submissions kan strömmas via endpointen — samma policy som övriga publika endpoints.
- `source_url`-restriktionen i `tracks`-tabellen påverkas inte; detta gäller bara den publika `submissions`-projektionen.

## Efter implementation

Jag kör en manuell körning av sync-endpointen mot katalogen och verifierar att rader landar i `tracks` och att en låt går att spela på `/musik`.
