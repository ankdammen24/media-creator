## Mål

Sökrutan (`⌘K`) ska bara matcha på **artistnamn**, **albumtitel** och **låttitel** — inte beskrivningar eller bios. Albums saknas idag och läggs till.

## Ändringar

### `src/components/GlobalSearch.tsx`

Tre parallella queries i stället för dagens tre:

1. **Spår/poddavsnitt** — `submissions` där `title ILIKE %q%` (status = approved). Tar bort matchning på `description`.
2. **Album** — ny query mot `albums` där `title ILIKE %q%`.
3. **Artister** — `artist_profiles` där `name ILIKE %q%`. Tar bort matchning på `bio`.

Resultatet renderas i tre `CommandGroup`-sektioner:

- **Artister** → navigerar till `/artists/$artistId`
- **Album** → navigerar till `/albums/$albumId` (visar omslag + artistnamn)
- **Spår & podd** → navigerar till `/catalog?focus=<id>` (oförändrat beteende)

Album-query hämtar även `artist_profiles!albums_artist_profile_id_fkey(id, name)` för att kunna visa artisten under albumtiteln. Om FK-namnet saknas, faller vi tillbaka på en separat join via `artist_profile_id`.

### Övrigt

- Placeholder-text uppdateras: `"Sök artist, album eller låt…"`.
- Knapp/etikett i header oförändrad (`"Sök i katalogen…"`).
- Debounce, min 2 tecken, kortkommando ⌘K — oförändrat.

## Påverkan

- Ren UI/datakälla-ändring i en fil. Inga schema- eller RLS-ändringar (albums är redan läsbar för alla, submissions filtreras på `status = approved`).
- Inga ändringar i routing eller andra sidor.
