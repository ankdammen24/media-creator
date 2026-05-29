## Mål

Göra det enkelt att dela låtar, album och artister till sociala nätverk och via direktlänk.

## Lösning

En återanvändbar `ShareButton`-komponent som öppnar en liten dialog/popover med:

- **Kopiera länk** (med toast-bekräftelse)
- **Snabbdelning** till: Facebook, X/Twitter, LinkedIn, WhatsApp, Telegram, Threads, e-post
- **Native share** (`navigator.share`) på mobil när det stöds — visas som primär knapp och faller annars tillbaka till listan ovan
- Förifylld titel + beskrivning per typ ("Lyssna på {låt} av {artist}", osv.)

Tekniskt:
- Använder web share intent-URL:er (inga API-nycklar, inget backend)
- Open Graph / Twitter Card-meta läggs i `head()` per route (titel, beskrivning, og:image från artwork) så att länkpreview ser bra ut
- Strukturerad data (JSON-LD `MusicRecording` / `MusicAlbum` / `MusicGroup`) för SEO

## Placering

1. **Låt** (`/tracks/$trackId`) — ShareButton bredvid Play
2. **Album** (`/albums/$albumId`) — bredvid Edit/Play i header
3. **Artist** (`/artists/$artistId`) — bredvid artistens namn/header
4. **TrackCard** (valfritt) — liten share-ikon vid hover

## Filer

- `src/components/ShareButton.tsx` (ny) — knapp + popover med delningsval
- `src/lib/share.ts` (ny) — hjälpfunktioner: bygg URL, social intents, getShareData per typ
- `src/routes/albums.$albumId.tsx` — lägg in ShareButton + og-meta från album/artwork
- `src/routes/artists.$artistId.tsx` — ShareButton + og-meta
- `src/routes/tracks.$trackId.tsx` — ShareButton + og-meta
- `src/i18n/locales/sv.json` + `en.json` — översättningar (Dela, Kopiera länk, Delat!, etc.)

Inga schemaändringar, inga nya beroenden — använder befintliga shadcn Popover/Dialog och lucide-ikoner (Share2, Link, Mail, plus brand-glyphs via inline SVG eller lucide).
