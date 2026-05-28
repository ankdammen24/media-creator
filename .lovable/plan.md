## Mål

Fyll automatiskt i saknade artist- och album-bilder från **iTunes Search API** (gratis, ingen auth, officiella Apple Music-omslag). Ingen AI-fallback — om inget hittas lämnas fältet tomt och du laddar upp manuellt.

## Hur det funkar

iTunes Search API: `https://itunes.apple.com/search?term=<namn>&entity=musicArtist|album&limit=1&country=SE`

- **Artist** → `artistLinkUrl`-träff har inga konsekvent stora bilder, så vi använder artistens första album-omslag som proxy (1000×1000, kvadratiskt — funkar utmärkt som avatar).
- **Album** → `results[0].artworkUrl100` byts upp till `600x600bb.jpg` (eller `1000x1000bb.jpg`).

Bilden laddas ner serverside, sparas i Supabase Storage-bucketen `artwork` under `auto/artists/<id>.jpg` resp. `auto/albums/<id>.jpg`, och stigen skrivs till `artist_profiles.avatar_path` / `albums.artwork_path`.

## Trigger — två lägen

### 1. Automatiskt vid skapande (bakgrund)
När en artist eller ett album skapas utan bild kör vi server-fn:n i bakgrunden (fire-and-forget från klienten efter `insert`). Slår på iTunes, sparar om träff. Inget blockerar UI:t.

### 2. Bulk-knapp i admin
På `/admin` ny sektion "Auto-omslag":
- **"Hämta saknade artist-bilder"** — loopar `artist_profiles` där `avatar_path IS NULL`, max ~50 per körning, returnerar `{ found, missed }`.
- **"Hämta saknade album-omslag"** — samma för `albums.artwork_path IS NULL`.

## Filer

- `src/lib/itunes.server.ts` — `searchArtistImage(name)`, `searchAlbumImage(title, artistName)`, returnerar `{ url, source: 'itunes' } | null`. Använder Node `fetch`, ingen extra dep.
- `src/lib/artwork.functions.ts` — server-fn:s:
  - `autoFetchArtistArtwork({ artistId })` — laddar artist, slår på iTunes, laddar ner bilden, `supabaseAdmin.storage.from('artwork').upload(...)`, uppdaterar `artist_profiles.avatar_path`. Returnerar `{ updated: boolean, path: string | null }`.
  - `autoFetchAlbumArtwork({ albumId })` — samma för album, slår med album-titel + artistnamn.
  - `bulkFetchMissingArtistArtwork()` / `bulkFetchMissingAlbumArtwork()` — admin-only via `requireSupabaseAuth` + `has_role` check, loopar saknade (max 50), kallar respektive enskild fn.
- `src/components/AdminAutoArtwork.tsx` — två knappar + resultattoast i admin.
- `src/routes/admin.tsx` — rendera `<AdminAutoArtwork />`.
- `src/routes/albums.new.tsx` + `src/components/AlbumForm.tsx` — efter lyckad insert utan uppladdad bild: kalla `autoFetchAlbumArtwork` fire-and-forget, invalidera query.
- `src/routes/artists.new.tsx` (om finns) eller artistprofil-formuläret — samma för artist.

## Notabelt

- **Ingen AI-fallback** — vid miss visas befintlig platshållare i UI.
- **Rate limit**: iTunes tillåter ~20 req/min per IP — bulk-jobbet pausar 100ms mellan anrop.
- **Inga schema-ändringar, inga RLS-ändringar, inget nytt secret** — använder existerande `artwork`-bucket (public) och `supabaseAdmin` (service role) för att skriva oavsett ägare.
- **Källattribution**: ingen krävs av iTunes Search API för icke-kommersiell katalogvisning, men vi lagrar `source = 'itunes'` i en eventuell framtida loggtabell om du vill (inte i denna iteration).
- **Uppgraderbarhet**: när du senare laddar upp en egen bild via formuläret skrivs `avatar_path`/`artwork_path` över som vanligt — auto-bilden raderas inte men referensen försvinner.
