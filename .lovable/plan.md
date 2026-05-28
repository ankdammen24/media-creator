# Upload → Podcast-only

Idag är Upload-flödet en generell "music or podcast"-uppladdare som återanvänder musik-fält. Vi gör om det till en renodlad **Podcast**-värld: poddar grupperas under en **Show/Serie**, och varje uppladdning är ett **Avsnitt (Episode)**. Musik går framöver enbart via Submit Music (Release Wizard).

## Vad krävs för att publicera en Podcast (kravspec)

Baserat på hur poddar normalt struktureras (Show → Episode, samma modell som RSS/Apple/Spotify) och er demo (Catalog + Radio Uppsala):

**Show / Serie-nivå** (grupperar avsnitt — återanvänder `albums`):
- Namn (titel) – obligatoriskt
- Beskrivning
- Omslag (kvadratiskt) – ärvs av avsnitt som saknar eget
- Kategori (t.ex. Samhälle, Kultur, Sport, Komedi …)
- Språk (finns redan på albums)

**Avsnitt / Episode-nivå** (återanvänder `submissions`, `media_type='podcast'`):
- Titel – obligatoriskt
- Ljudfil – obligatoriskt
- Omslag (valfritt, faller tillbaka på show-omslag)
- Beskrivning / show notes
- Säsongsnummer + avsnittsnummer (avsnittsnr auto om tomt)
- Avsnittstyp: Full / Trailer / Bonus
- Värd(ar) (hosts) och gäster (guests)
- Publiceringsdatum (planerat)
- Explicit innehåll (ja/nej)

**Publicering**: Som musik-demon — avsnittet sparas i Media Rosenqvist Catalog och skickas till Radio Uppsala för granskning. Ingen distribution till Spotify/Apple Podcasts (demo).

## Datamodell (migration)

Vi återanvänder befintliga tabeller för minsta möjliga omskrivning:

- `album_type`-enum: lägg till värdet `podcast_show`. En "Show" = en `albums`-rad med `album_type='podcast_show'`.
- `albums`: ny kolumn `podcast_category text`.
- Ny enum `podcast_episode_type` = (`full`, `trailer`, `bonus`).
- `submissions`: nya kolumner
  - `season_number integer`
  - `episode_number integer`
  - `episode_type podcast_episode_type default 'full'`
  - `hosts text[] default '{}'`
  - `guests text[] default '{}'`
  - `scheduled_publish_at timestamptz`
  - (återanvänder befintliga: `explicit`, `description` = show notes, `album_id` = show, `artwork_path`)

Befintlig RLS på `albums`/`submissions` täcker redan ägare + admin, så inga nya policies behövs (kolumntillägg ärver tabellens policies).

## Frontend

### `/upload` (single)
- Ta bort "Media type"-väljaren — sidan är alltid podcast. Byt rubrik/copy/ikoner till poddvärld ("Submit a podcast episode", Mic-ikon).
- Ersätt `AlbumPicker` med en **ShowPicker** (samma inline-create-mönster, men filtrerar/skapar `album_type='podcast_show'` och frågar efter kategori vid create). Obligatorisk.
- Lägg till avsnittsfält: säsong, avsnittsnummer (auto om tomt), avsnittstyp (Full/Trailer/Bonus), värdar, gäster, publiceringsdatum, explicit-toggle.
- Episodomslag blir valfritt (faller tillbaka på show-omslag via befintlig `effectiveArtworkPath`); ljud + titel + show fortsatt obligatoriskt.
- Uppdatera insert till `submissions` med de nya fälten; sätt `media_type='podcast'`, `album_id = showId`, `episode_number`.
- Uppdatera demo-banner och success-text till poddformuleringar (Catalog + Radio Uppsala).

### `/upload-batch`
- Gör podcast-only: ta bort musik-default och musiklogik. Delade inställningar = Show + (valfri) säsong + delat omslag.
- Per fil: titel, beskrivning, auto avsnittsnummer inom showen (analogt med dagens track-number). Avancerade per-avsnitt-fält hålls i single-flödet.
- Uppdatera copy/ikoner/demo-banner.

### Pickers & helpers
- Ny `nextEpisodeNumber(showId)` (som `nextTrackNumber`, men på `episode_number`).
- `AlbumPicker` (musik) filtreras till `album_type <> 'podcast_show'` så shows inte dyker upp i musikflöden.

### Visning (editor-meta + listor)
- `EditorCardMeta`: lägg till podd-badges (S/E-nummer, avsnittstyp, explicit, antal gäster) för podcast-objekt (admin/artist).
- Artistsidan: separera "Shows" från musik-album i albumlistan (filtrera på `album_type`).
- Återanvänd `albums.$albumId`-sidan för en Show och visa "Episodes" istället för "Tracks" när `album_type='podcast_show'` (lättviktig label-anpassning).

### Navigation
- `SiteHeader`: ge Upload-knappen poddformulering/ikon (t.ex. "Upload podcast", Mic) och behåll Demo-badge.

## Ordning
1. Migration (enum + kolumner) – godkänns först, sedan typgenerering.
2. Helpers + ShowPicker.
3. Skriv om `/upload` och `/upload-batch`.
4. Visning (EditorCardMeta, artistsida, show-sida) + header-copy.

## Tekniska detaljer
- Inga nya RLS-policies; kolumner ärver befintliga tabellpolicies.
- `episode_type` som enum för datakonsistens (ingen tidsberoende CHECK).
- Ingen backend-publiceringsändring — demo-flödet (Catalog + Radio Uppsala) återanvänds; endast metadata + copy ändras.
