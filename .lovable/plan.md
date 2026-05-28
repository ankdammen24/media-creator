## Mål

Förstasidan ska kännas levande — när man kommer in ser man direkt vad som spelas, kan trycka play på vilket spår eller avsnitt som helst, och har en mini-spelare i botten som följer med när man bläddrar vidare.

## 1. Hero — stor "Now Playing"

Ersätt dagens lilla hero med en bred hero överst som visar utvalt spår (senaste godkända musik-submission):

- Stort omslag (kvadrat) till vänster, suddig blow-up av samma omslag som bakgrund i hela hero-sektionen
- Titel, artistnamn (länk till artistsida), "MUSIC"-badge
- Stor primär play-knapp → börjar spela spåret i den globala spelaren
- Sekundära knappar: "Browse catalog" och "Submit media"
- Hero är responsiv: bild ovanför text på mobil

## 2. Globalt uppspelningssystem

Bygg en lättviktig spelar-kontext (`PlayerProvider`) som hanterar nuvarande spår, paus/play och kö. Två synpunkter:

- **Inline play-knapp på varje spår-kort** (hero, "Nyaste spår", "Senaste podd"). Klick → laddar spåret i den globala spelaren och börjar spela. Andra kort visar pausläge.
- **Persistent mini-spelare** fäst längst ner på alla sidor när något är laddat. Visar omslag, titel, artist, play/paus, progress-bar och tid. Stänger man inte den så fortsätter den spela vid navigation.

Audio-URL hämtas via `supabase.storage.from("audio").createSignedUrl(...)` precis som idag i `CatalogCard`.

## 3. Nya sektioner under hero

- **Nyaste spår** — 8 senaste godkända med `media_type = music`, befintlig grid men varje kort får inline play-knapp som overlay på omslaget
- **Senaste poddavsnitt** — egen sektion, 4 senaste godkända med `media_type = podcast`, lite bredare kort med beskrivning
- **Utvalda artister** — rad med 6–8 artistprofiler (avatar + namn) som länkar till `/artists/$artistId`. Hämtas från artister som har minst en godkänd submission

## 4. Styling

Behåll befintliga design-tokens (`bg-card`, `border-border`, `primary`). Lägg till lite mer visuell tyngd i hero med:

- Suddig artwork-bakgrund med overlay-gradient mot `background`
- Mjuk skugga under spelarkortet
- Mini-spelaren använder `backdrop-blur` + `bg-card/80`

## Tekniska detaljer

**Nya filer:**
- `src/components/player/PlayerProvider.tsx` — React Context med `currentTrack`, `isPlaying`, `play(track)`, `toggle()`, `seek()`. Håller ett internt `<audio>`-element via ref.
- `src/components/player/MiniPlayer.tsx` — fixed bottom bar, läser från contexten
- `src/components/player/PlayButton.tsx` — återanvändbar knapp som visar play/paus beroende på om kortet matchar `currentTrack`
- `src/components/home/Hero.tsx` — ny hero med utvalt spår
- `src/components/home/LatestMusic.tsx`, `LatestPodcasts.tsx`, `FeaturedArtists.tsx` — sektioner

**Ändrade filer:**
- `src/routes/__root.tsx` — wrappa `<Outlet />` i `<PlayerProvider>` och rendera `<MiniPlayer />` utanför outlet
- `src/routes/index.tsx` — byt ut nuvarande layout mot ny hero + tre sektioner
- `src/routes/catalog.tsx` — använd `PlayButton` istället för `<audio controls>` (frivilligt men konsekvent)

**Data-queries (alla i `src/lib/queries.ts`):**
- `featuredTrackQuery` — senaste godkända music-submission
- `latestMusicQuery(8)`, `latestPodcastsQuery(4)`
- `featuredArtistsQuery(8)` — distinct artist_profile_id från godkända submissions, joina mot `artist_profiles`

Alla använder den nya FK-hinten `artist_profiles!submissions_artist_profile_id_fkey`.

## Utanför scope

- Spellistor/kö-hantering (bara "spela detta" för nu)
- Auto-spela vid sidladdning (kräver user gesture)
- AzuraCast live-radio-widget (du valde bort den)
