## Mål

Förenkla flödet under **Mine**: istället för en platt lista över alla submissions, visa de **artistprofiler du äger** (eller alla, om du är artist/admin). Därifrån går man in på artisten och får en hierarki: **Artist → Album → Låt**. En låt utan album räknas som en **Single** (album = låtens namn).

```text
Mine (lista över egna artister)
 ├─ [+ Skapa ny artist]
 └─ Artist X ──► /artists/:id
                  ├─ Profil + redigera
                  ├─ Album (kort: riktiga album + "singlar" för albumlösa låtar)
                  │    └─ [+ Nytt album]  (befintlig sida listar redan lediga låtar att koppla in)
                  └─ Lösa låtar (singles) listade som egna "album-kort"
```

## Ändringar

### 1. `/my-submissions` görs om till en artistlista
- Hämta `artist_profiles` där `user_id = auth.uid()` (icke-editorer) eller alla (editorer), tillsammans med antal album och antal submissions per artist.
- Visa varje artist som ett kort: avatar, namn, "N album · M låtar", länk till `/artists/:id`.
- Primär CTA högst upp: **"Skapa ny artist"** → `/artists/new`.
- Tomt läge: kort som uppmanar att skapa första artisten.
- Behåll sidans titel "Mine" men beskrivningen blir "Dina artister, deras album och låtar". Den gamla submission-redigeringen (`EditSubmissionDialog`, `DeleteSubmissionButton`, osv.) flyttas inte hit — den når man fortfarande via album-/artistsidan respektive på sikt via en låt-vy. Inget gammalt admin-flöde tas bort, bara den här sidans roll.

### 2. Ny route `/artists/new`
- Enkel skapaformulär: `name` (krav), `bio`, ev. `website_url`. Skriver till `artist_profiles` med `user_id = auth.uid()`. Vid lyckad insert navigera till `/artists/:id`.
- Skyddad route (`ProtectedRoute`).

### 3. Artistsidan `/artists/$artistId` får sektion **Album**
- Hämta även `albums` för artisten (id, title, album_type, artwork_path, release_date, tracks-räkning via separat liten join eller count).
- Hämta artistens submissions där `album_id IS NULL` — dessa visas som "Singles" i samma album-rutnät, men korten länkar direkt till låten/spelar den (ingen album-route, eftersom det inte finns något album-id).
- Layout: profil-header (oförändrad) → **Album**-grid (riktiga album + singel-kort blandade, singlar märks med badge "Single") → behåll befintlig "godkända media"-lista längre ner som fallback/översikt, eller ersätt den med Album-griden om listan blir överflödig. Förslag: ersätt nuvarande platta lista med album-grid; för albumlösa låtar visa "Singles"-kort som spelar låten direkt.
- Befintlig **"Nytt album"**-knapp behålls; den leder redan till `/albums/new?artistId=...`, och album-sidan har redan en "Lägg till låtar"-sektion som listar artistens albumlösa submissions — så kravet "lista potentiella låtar förknippade med artisten" är redan löst där och kräver ingen ny kod.

### 4. Header
- "Album"-snabblänken i `SiteHeader` är inte längre nödvändig (eftersom man skapar album inifrån en artist). Ta bort den för att undvika dubbletter.

## Tekniska detaljer

- **Filer som ändras / skapas**
  - `src/routes/my-submissions.tsx` — byggs om från grunden till artistlista (filnamnet behålls så header-länken fortsätter fungera).
  - `src/routes/artists.new.tsx` — ny route med skapaformulär.
  - `src/routes/artists.$artistId.tsx` — lägg till album-/singles-grid; behåll profilredigerings­logik.
  - `src/components/SiteHeader.tsx` — ta bort `Album`-länken.

- **Queries**
  - Mine: `artist_profiles` filtrerad på `user_id` (eller alla för editor) + parallella `count`-queries på `albums` och `submissions` per artist (eller en samlad fetch + gruppera i klienten).
  - Artistsidan: extra hämtning av `albums` för artist + submissions med `album_id IS NULL`.

- **RLS** — inga ändringar behövs. Insert på `artist_profiles` är redan tillåtet via *"Users create own artist profiles"* (`auth.uid() = user_id`). Befintliga album-/submission-policies fortsätter gälla.

- **Singles utan album** — visas som UI-kort i album-griden men sparas inte som riktiga albumrader. Ingen schemaändring.

## Utanför scope
- Ingen ändring i databasen.
- Ingen ändring i ladda-upp-flödet.
- Ingen ändring i admin-vyn.
