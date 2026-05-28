# EPK för artister – grundarkitektur

Vi bygger i fyra etapper. Varje etapp är fristående och kan släppas separat. Etapp 1 ger oss `artist_images` direkt; resten i tur och ordning.

## Datamodell (etapp 1 – migrering nu)

Ny tabell **`artist_images`**:
- `artist_profile_id` (uuid)
- `user_id` (uuid, för RLS)
- `storage_path` (text, i `artwork`-bucket under `artists/<id>/...`)
- `kind` enum `('avatar' | 'cover' | 'press')` – avatar = rund profilbild, cover = bred hero, press = pressbild i galleri
- `is_primary` (bool) – en `avatar` och en `cover` kan vara primary per artist (partial unique index)
- `visibility` enum `('public' | 'link_only')`
- `caption`, `credit` (text, för fotografkredd i EPK)
- `sort_order` (int)
- `created_at`, `updated_at`

**Bakåtkompatibilitet:** befintlig `artist_profiles.avatar_path` behålls som fallback. En vy/funktion läser primary avatar från `artist_images` om finns, annars `avatar_path`. Auto-fetch från iTunes fortsätter skriva till `avatar_path` (oförändrat) – kunden kan sen "befordra" till galleriet manuellt.

**RLS:** publik SELECT där `visibility = 'public'`. Ägare + admin ser allt, kan skriva/radera egna.

## Etapp 2 – Bio kort/lång

Lägg till `artist_profiles.bio_short` (text, max ~280 tecken UI-validerat) bredvid befintlig `bio` som blir "lång". Inget databasbrott.

## Etapp 3 – Pressmeddelanden (PDF)

Tabell **`artist_press_releases`**: `artist_profile_id`, `user_id`, `title`, `storage_path` (ny bucket `press`, privat), `visibility`, `published_at`. RLS som ovan. Public-länk via signerad URL för `link_only`, direkt publik URL (proxad genom server-fn som kollar visibility) för `public`.

## Etapp 4 – Videolänkar

Tabell **`artist_videos`**: `artist_profile_id`, `user_id`, `title`, `url` (YouTube/Vimeo), `visibility`, `sort_order`. Bädda in via oEmbed-thumbnail – ingen extern API krävs för YouTube/Vimeo.

## EPK-vy och delningslänk

- Befintlig artistsida visar `public`-innehåll automatiskt (galleri, bio, videos, press).
- Ny route `/epk/$artistSlug?token=<...>` – om token matchar artistens `epk_share_token` (nytt fält på `artist_profiles`) visas även `link_only`-innehåll. Token kan roteras från admin.
- "Kopiera EPK-länk"-knapp i artistens redigeringsformulär.

## UI denna omgång (etapp 1)

- `ArtistImageManager`-komponent i artistformuläret: dra-och-släpp uppladdning, välj `kind`, markera primary, sätt `visibility`, omordna.
- Artistsidan: hero använder primary `cover` om finns, annars primary `avatar`/fallback. Galleri-sektion under bio visar publika `press`-bilder.

## Vad jag gör i denna prompt

Endast **etapp 1** (datamodell + bildgalleri-UI + integration på artistsida). Bio/PDF/video kommer i separata promptar så vi kan testa stegvis.

## Tekniska detaljer

- Migrering skapar `artist_images` med GRANT, RLS, trigger för `updated_at`, partial unique index på `(artist_profile_id, kind) where is_primary`.
- Storage: `artwork`-bucket (redan publik) under `artists/<artist_id>/<uuid>.<ext>`. För `link_only`-bilder används privat path + signerad URL (servar via server-fn).
- Frontend: `src/components/ArtistImageManager.tsx`, server-fn `src/lib/artist-images.functions.ts` för uppladdning/sortering/primary-byte.
- Befintlig auto-fetch logik orörd.

Säg till om något av detta ska justeras innan jag kör igång.
