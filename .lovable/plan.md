## Mål

Lägg till en fjärde flik i Catalog: **All · Music · Podcast · Artists**. När `Artists` är aktiv visas ett rutnät med alla artister (avatar + namn). Klick på ett artistkort går till befintliga `/artists/$artistId` (album-vyn för artisten — möjligheten finns kvar).

## Ändringar (endast `src/routes/catalog.tsx`)

1. **Utöka `Tab`-typen** till `"all" | "music" | "podcast" | "artists"` och lägg till knappen i samma toggle-grupp som finns idag.

2. **Hämta artister separat** med en ny `useQuery(["catalog","artists"])` som läser `artist_profiles` (id, name, avatar_path) sorterade på namn. Körs alltid så att fliken är direkt redo; cache 60s.

3. **Render-logik**:
   - När `tab !== "artists"`: nuvarande beteende (release-kort, artistfilter-dropdown, sökning på titel/artist).
   - När `tab === "artists"`:
     - Dölj artistfilter-dropdown (irrelevant).
     - Sökrutan filtrerar på artistnamn.
     - Visa rutnät av artistkort: kvadratisk avatar (eller initial-placeholder om `avatar_path` saknas), namn under, hela kortet är `<Link to="/artists/$artistId">`.
     - Samma responsiva grid som releases (1/2/3/4 kolumner).
     - Tom-state: "Inga artister matchar".

4. **`focus`-search-param**: om `focus` används, fortsätt återställa till `tab="all"` så att den fokuserade releasen blir synlig (oförändrat).

5. **Inga route-ändringar**, ingen DB-ändring, ingen ny komponentfil — håller det till en presentations-edit.

## Out of scope
- Ingen ändring i `/artists/$artistId`-vyn.
- Ingen separat route `/catalog/artists` (vi behåller en route med flikar; enklare delning av sökfält och layout).
- Ingen ändring i headern/navigationen.
