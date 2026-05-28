# Catalog Metadata Import (UPC/ISRC från Excel)

Importerar metadata för befintliga artister, album och låtar från en .xlsx-fil. Skapar **aldrig** nya poster automatiskt — bara matchar och berikar.

## Excel-format som filen följer

Filen `ISRC.xlsx` har ett blad per artist. Bladets namn = artistens namn.
Inuti varje blad ligger flera album-block i kolumn B:

```
Rich Evans                        ← A1 = artistnamn
  Motel Liing                     ← albumtitel
  UPC: 194694854466
  (tom rad)
  Lucky Didn't Make It: QZES71974920   ← "Låttitel: ISRC"
  Drown in Your Love: QZES71974921
  ...
  (tom rad)
  Kentucky Bourbon                ← nästa album
  UPC: 194694853797
  ...
```

Parsern delar bladet på tomma rader, första raden i blocket = albumtitel, rad som börjar med `UPC:` ger UPC, övriga rader splittas på sista `:` till `title` + `ISRC`.

## Databasändringar (migration)

Lägger till frivilliga (nullable) fält. Inget destruktivt.

**`albums`**
- `upc text` (nullable)
- `external_catalog_source text` (nullable)
- `metadata_imported_at timestamptz` (nullable)
- index `idx_albums_upc` på `upc`

**`submissions`** (låtar) — `isrc` finns redan
- `upc text` (nullable, ärver releasens UPC)
- `external_catalog_source text` (nullable)
- `metadata_imported_at timestamptz` (nullable)
- index `idx_submissions_isrc` på `isrc`

**`import_runs`** (ny tabell, admin-only)
- `source` (`'xlsx'`), `filename`, `created_by uuid`, `status`, `summary jsonb`, `created_at`, `completed_at`

**`import_rows`** (ny tabell, admin-only)
- `run_id`, `sheet_name`, `row_index`, `artist_name_raw`, `album_title_raw`, `track_title_raw`, `upc_raw`, `isrc_raw`
- `match_status` (`matched | partial | unmatched | duplicate | skipped | conflict | applied`)
- `matched_artist_id`, `matched_album_id`, `matched_submission_id`
- `proposed_changes jsonb`, `applied_changes jsonb`, `notes text`

RLS: bara admin (`has_role(auth.uid(),'admin')`) får läsa/skriva. GRANTs på `authenticated` + `service_role`.

## Server-funktioner (`src/lib/catalog-import.functions.ts`)

Alla skyddade med `requireSupabaseAuth` + admin-check.

1. **`parseCatalogImport(fileBytes, filename)`** — parsar xlsx (med `xlsx`-paket), kör matchning mot DB **utan att skriva**, skapar `import_runs`-rad + `import_rows`, returnerar förhandsgranskning (alla rader med status och föreslagna ändringar).
2. **`applyCatalogImport(runId, decisions[])`** — `decisions` = lista per rad `{rowId, action: 'apply'|'overwrite'|'skip'}`. Skriver UPC till album, ISRC/UPC till submission. Standard: skriv **endast i tomma fält**. `overwrite` krävs explicit per rad.
3. **`getImportRun(runId)`** — hämtar run + rader.
4. **`listImportRuns()`** — historik.

### Matchningslogik (case-insensitive, trim)

1. **Artist**: bladnamn → `artist_profiles.name` (exakt, sen normaliserat). Saknas → hela bladet markeras `unmatched`.
2. **Album**: titel inom artistens album (`albums.artist_profile_id = X`). Saknas → block-status `unmatched` (alla låtar i blocket också). UPC skapar **aldrig** album.
3. **Låt**: `submissions` där `album_id = matched_album_id` och `title` ≈ raw-titel. 
4. **Dubletter**:
   - Finns ISRC redan på **samma** submission → `skipped` (ingen ändring).
   - Finns samma ISRC på **annan** submission → `conflict` (visas men appliceras inte utan overwrite).
   - Samma låttitel på flera album: album-relationen vinner (steg 2 har redan begränsat scopet).

## Admin-UI

Ny flik `Catalog Import` i `src/routes/admin.tsx` + komponent `src/components/AdminCatalogImport.tsx`:

- **Upload**: drag/drop .xlsx → kör `parseCatalogImport`.
- **Preview-tabell** grupperat per blad → album → rader:
  - Kolumner: Artist | Album | Track | UPC (current → new) | ISRC (current → new) | Status-badge | Action (`Apply` / `Overwrite` / `Skip`)
  - Statusfärger: matched=grön, partial=gul, unmatched=grå, conflict=röd, duplicate/skipped=blå.
- **Sammanfattning** överst: X matched, Y conflicts, Z unmatched.
- **Knapp**: `Apply selected` → `applyCatalogImport` med beslut per rad.
- **Historik**: lista över tidigare `import_runs` med summary, klickbar för detaljer.

## Säkerhet & spårbarhet

- Allt går via admin-skyddade server-funktioner.
- `applied_changes` på varje rad innehåller `{field, before, after}` → reversibelt manuellt om det skulle behövas.
- Inget block får skapa nya artister, album eller låtar — den hårda regeln ligger i server-funktionen, inte bara i UI.
- Loggning via `import_runs.summary` (totals) + per-rad i `import_rows`.

## Filer som skapas/ändras

- migration: ny fält + två tabeller
- `src/lib/catalog-import.functions.ts` (ny)
- `src/lib/catalog-import.server.ts` (parser-helpers)
- `src/components/AdminCatalogImport.tsx` (ny)
- `src/routes/admin.tsx` (ny flik)
- `package.json`: lägger till `xlsx` (eller `exceljs`) för parsning serverside

## Öppna frågor

Inget blockerande — Excel-formatet är dekodat och databasen har redan `isrc` på submissions. Vill du att vi **alltid** propagerar album-UPC till alla submissions på samma album, eller endast om Excel-blocket explicit listar låten? (Default i planen: bara raderna som finns i Excel.)
