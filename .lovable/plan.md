
## Mål

Gör förstasidan till en lugnare ingång till katalogen. Korten ska vara direkta genvägar in i `/catalog`, inte egna delsidor. Innehåll roteras var fjärde timme, inte var femte minut.

## Ändringar på `src/routes/index.tsx`

### 1. Rotation: var 4:e timme istället för 5 min
- `useShuffleTick` ändras från `5 * 60 * 1000` till `4 * 60 * 60 * 1000`.
- Används både för "Mest spelade" (urval ur topp‑listan) och "Utvalda artister".
- "Senaste musik" roteras inte alls — den ska visa de faktiskt senaste.

### 2. Alla låtkort och artistkort länkar in i katalogen
- Hela låtkortet wrappas i `<Link to="/catalog" search={{ focus: item.id }}>`. Katalogen har redan `focus`‑stödet och scrollar/markerar låten.
- Play‑knappen ligger ovanpå kortet och stoppar event‑propagation så den spelar i bottenspelaren utan att navigera.
- Artistkort i "Utvalda artister" länkar fortsatt till `/artists/$artistId` (där finns hela artistens katalog). Bekräfta om du istället vill ha `/catalog` filtrerat per artist — då lägger vi till en `artist`‑sökparameter på `/catalog`.

### 3. Sektioner och layout
Ny ordning under hero:

1. **Senaste musik** — 4 nyaste låtarna först, därefter horisontellt scrollande lista med följande (upp till ~20). Snap‑scroll, dölj scrollbar, pil‑knappar på desktop.
2. **Mest spelade** — 4 mest spelade låtarna först, sen samma horisontella karusell med fortsättningen. Källa: aggregera `playback_events` (event_type `play` + `radio_spin`) över t.ex. senaste 30 dagar och sortera per `submission_id`. Görs i en ny `getMostPlayed` server‑fn i `src/lib/stats.functions.ts` som returnerar de N senaste topplåtarnas submissions‑ID:n (anonym åtkomst, ingen `requireSupabaseAuth`).
3. **Senaste podcaster** — behålls som idag men flaggas som "kommer snart" om listan är tom (ingen ändring i datakällan).
4. **Utvalda artister** — slumpas ur senaste ~50 godkända, byts var 4:e timme.

### 4. Dela‑knappar
- Återanvänd befintliga `src/components/ShareButton.tsx`.
- Lägg till en kompakt `ShareButton` på varje låtkort, podcast‑kort och artistkort med `path={\`/catalog?focus=${id}\`}` resp. `/artists/...`. Storlek `sm`, variant `ghost`, ikon‑only på små skärmar för att inte ta plats.
- Lägg till en `ShareButton` i bottenspelaren (`MiniPlayer`) som delar låten som spelas just nu (`path` = `/catalog?focus=<currentTrack.id>`). Visas bara när det finns en aktuell låt.

### 5. Gilla‑knapp (diskussion, ingen implementation nu)
Förslag att bestämma efteråt: en `track_likes`‑tabell med `(user_id, submission_id, created_at)`, UNIQUE‑constraint, RLS så att inloggade kan gilla/avgilla sina egna rader och alla kan läsa aggregat via en view. Använd sedan totalen som en signal till "Mest spelade"‑sortering, samt visa hjärta + antal på korten. Vi tar inte med detta i denna runda.

## Tekniska detaljer

```text
src/routes/index.tsx
  - useShuffleTick: 4 * 60 * 60 * 1000
  - <Hero /> oförändrad (förutom ev. ShareButton i CTA‑raden)
  - <LatestMusic />:
      query limit 20, INGEN shuffle, ta [0..3] som "first row"
      och [4..] som horisontell karusell
  - <MostPlayed /> NY:
      useQuery -> getMostPlayed({ limit: 20, windowDays: 30 })
      shuffleTick används bara om vi vill rotera bland topp‑20
  - <LatestPodcasts /> oförändrad
  - <FeaturedArtists /> oförändrad logik, ny tick (4 h)
  - TrackCard wrappad i <Link to="/catalog" search={{ focus }}>
      Play‑knapp + Share‑knapp stoppar event propagation
  - Lägg till <HorizontalRail> hjälpkomponent:
      overflow-x-auto, snap-x snap-mandatory, scrollbar dold,
      barn = TrackCard med w-[180px] sm:w-[200px]

src/lib/stats.functions.ts
  + getMostPlayed: createServerFn, anonym, hämtar topp‑N submissionsId
    senaste N dagar, returnerar fullständiga submission‑rader joinade
    med artist_profiles + albums i samma shape som befintliga "Row".

src/components/player/MiniPlayer.tsx
  + ShareButton för aktuell låt
```

## Vad ändras inte
- Spelar‑logik, audio‑unlock, mobil play‑knapps‑synlighet.
- Album‑artwork‑sweepen som redan körs var 15:e minut.
- Catalog‑sidan i sig — vi använder bara `focus`‑parametern som redan finns.

## Öppna frågor
1. Ska artistkort på förstasidan länka till `/artists/$artistId` (som idag) eller till `/catalog` filtrerat per artist? Om det senare behöver vi även lägga till artist‑filter‑param i `/catalog`.
2. Ska "Mest spelade" räkna senaste 30 dagar eller all‑time? Förslag: 30 dagar så listan känns levande.
