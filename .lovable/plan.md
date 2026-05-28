## Mål

Lägg till en global sökfunktion som är tillgänglig från `SiteHeader` på samtliga sidor. Söker över allt vi visar i katalogen (submissions) samt artistprofiler.

## UX

- En sökruta i `SiteHeader` (centrerad mellan logga och nav, krymper på mobil till en ikon som öppnar en dialog).
- Kortkommando `⌘K` / `Ctrl+K` öppnar en command palette (shadcn `Command` + `Dialog`).
- Live-resultat när man skriver (debounce 200ms, min 2 tecken), grupperat:
  - **Spår & podd** (submissions med status `approved` — titel, beskrivning, artistnamn)
  - **Artister** (artist_profiles — namn, bio)
- Klick på ett resultat navigerar:
  - Submission → `/catalog?focus={id}` (öppnar katalogen och scrollar/markerar kortet)
  - Artist → `/artists/$artistId`
- Tom state, laddningstillstånd och "Inga träffar".

## Implementation

1. **Ny komponent** `src/components/GlobalSearch.tsx`
   - Använder shadcn `CommandDialog`, `CommandInput`, `CommandList`, `CommandGroup`, `CommandItem`.
   - `useQuery` med `queryKey: ["global-search", q]`, `enabled: q.length >= 2`.
   - Två parallella Supabase-queries:
     - `submissions` med `.eq("status","approved")` + `.or("title.ilike.%q%,description.ilike.%q%")` joinat med `artist_profiles(id,name)`, limit 10. Plus separat query där vi filtrerar på artistnamn via inner-join (`artist_profiles!inner(...)` + `.ilike("artist_profiles.name","%q%")`), limit 10, och dedupar.
     - `artist_profiles` med `.or("name.ilike.%q%,bio.ilike.%q%")`, limit 10.
   - Global keybind via `useEffect` på `keydown` (`(e.metaKey||e.ctrlKey) && e.key==="k"`).
   - Trigger-knapp: inline input-attrapp på desktop (`sm:` synlig), bara `Search`-ikonknapp på mobil.

2. **`SiteHeader.tsx`**: rendera `<GlobalSearch />` mellan logga och `<nav>`. Justera flex/spacing så det funkar både inloggad och utloggad.

3. **`catalog.tsx`**: läs sökparam `focus` via `validateSearch` (zod) och scrolla in i vy + lägg en kort ring runt matchande kort i ~2s. Befintlig lokal sökruta på katalogsidan behålls.

4. Inga schemaändringar. Inga RLS-ändringar (publika `approved`-submissions och `artist_profiles` är redan läsbara för anon).

## Tekniska detaljer

- `Command` från `src/components/ui/command.tsx` finns redan installerad.
- Använd `supabase` direkt (klientsidan, RLS gäller). Ingen ny serverFn behövs.
- Debounce med en liten `useEffect`+`setTimeout` (ingen ny dep).
- Resultatraderna visar artwork-thumbnail (24px) via `supabase.storage.from("artwork").getPublicUrl(...)` för submissions.

## Filer

- skapa: `src/components/GlobalSearch.tsx`
- ändra: `src/components/SiteHeader.tsx` (montera GlobalSearch)
- ändra: `src/routes/catalog.tsx` (focus-search-param + scroll/highlight)
