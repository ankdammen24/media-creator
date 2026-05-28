# Komplett ägarbyte av artister + audit-logg + FK-fix

Två sammanhängande problem löses i samma omgång:

1. **Ägarbyte i admin uppdaterar bara `artist_profiles.user_id`** → relaterade rader (`albums`, `submissions`, `artist_images`) blir kvar hos gamla ägaren och nya ägaren blockas av RLS.
2. **Saknade foreign keys** → PostgREST kraschar med "Could not find a relationship between 'albums' and 'artist_profiles'" och relaterade joins är ömtåliga.

## Steg 1 — Migration

### 1a. Lägg till saknade foreign keys + index

```sql
ALTER TABLE public.albums
  ADD CONSTRAINT albums_artist_profile_id_fkey
  FOREIGN KEY (artist_profile_id) REFERENCES public.artist_profiles(id)
  ON DELETE CASCADE;

ALTER TABLE public.artist_images
  ADD CONSTRAINT artist_images_artist_profile_id_fkey
  FOREIGN KEY (artist_profile_id) REFERENCES public.artist_profiles(id)
  ON DELETE CASCADE;

ALTER TABLE public.submission_artists
  ADD CONSTRAINT submission_artists_submission_id_fkey
  FOREIGN KEY (submission_id) REFERENCES public.submissions(id) ON DELETE CASCADE,
  ADD CONSTRAINT submission_artists_artist_profile_id_fkey
  FOREIGN KEY (artist_profile_id) REFERENCES public.artist_profiles(id) ON DELETE CASCADE;
```

`submissions → artist_profiles` och `submissions → albums` läggs till på samma sätt om de inte redan finns (idempotent via `DO`-block). Index skapas för varje FK-kolumn för join-prestanda. Avslutas med `NOTIFY pgrst, 'reload schema';`.

### 1b. Skapa `artist_ownership_log`

```sql
CREATE TABLE public.artist_ownership_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_profile_id uuid NOT NULL REFERENCES public.artist_profiles(id) ON DELETE CASCADE,
  from_user_id uuid NOT NULL,
  to_user_id uuid NOT NULL,
  changed_by uuid NOT NULL,           -- admin som gjorde ändringen
  affected_albums int NOT NULL DEFAULT 0,
  affected_submissions int NOT NULL DEFAULT 0,
  affected_images int NOT NULL DEFAULT 0,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.artist_ownership_log TO authenticated;
GRANT ALL  ON public.artist_ownership_log TO service_role;

ALTER TABLE public.artist_ownership_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read ownership log"
  ON public.artist_ownership_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
-- Inga insert/update/delete-policys: bara service_role (server-fn) får skriva.
```

## Steg 2 — Server-fn för ägarbyte

Ny fil `src/lib/admin-ownership.functions.ts` med `reassignArtistOwner` (POST):

- `inputValidator` (Zod): `{ artistId: uuid, newUserId: uuid, reason?: string }`
- `middleware: [requireSupabaseAuth]` — hämtar `userId` (= changed_by)
- Verifierar att anroparen är admin via `has_role` (annars `throw new Error("Forbidden")`)
- Använder `supabaseAdmin` för att:
  1. Läsa nuvarande `artist_profiles.user_id` (= `from_user_id`)
  2. Räkna `albums`, `submissions`, `artist_images` som tillhör artisten
  3. Uppdatera `user_id` i alla fyra tabellerna (`artist_profiles`, `albums`, `submissions`, `artist_images`) WHERE `artist_profile_id = :artistId`
  4. Skriva en rad till `artist_ownership_log`
- Returnerar `{ from, to, counts: { albums, submissions, images } }`

Filen läggs i `src/lib/` (inte `src/server/`) och hålls "thin" (bara server-fn + dess imports) — undviker det transitiva `client.server`-importproblemet.

Ny fil `src/lib/admin-ownership-log.functions.ts` med `listOwnershipLog` (GET, admin-only) som läser senaste 50 rader joinade med `profiles.display_name` för "from/to/changed_by".

## Steg 3 — UI-ändringar

### `src/routes/admin.tsx`

- `<select>` byts mot **Combobox + "Byt ägare"-knapp**. Ingen on-change-mutation.
- Klick på knapp → öppnar dialog (shadcn `AlertDialog`) med:
  - "Du flyttar **Artistnamn** från **Gammal ägare** till **Ny ägare**."
  - Visar antal album, submissions och bilder som flyttas med (förhandshämtat via en lättviktig count-query, eller hämtas i samma server-fn med `{ preview: true }`).
  - Valfritt textfält "Anledning".
  - Bekräfta → kallar `reassignArtistOwner` via `useServerFn`.
- Toast med resultat ("Flyttade 3 album, 12 låtar, 4 bilder").
- Invalidatar `["admin-artists"]`, `["catalog"]`, `["artist", artistId]`.

### Ny komponent `src/components/AdminOwnershipLog.tsx`

- Tabell: Datum, Artist, Från → Till, Av (admin), Påverkade rader, Anledning.
- Renderas i `admin.tsx` under "Artists"-sektionen.

## Tekniska detaljer

- All mutation skrivs med `supabaseAdmin` i en server-fn — RLS bypassas medvetet, säkerheten upprätthålls av admin-checken inuti handlern.
- Atomicitet: Supabase-JS har ingen transaktion klient-side. Vi kör uppdateringarna sekventiellt och loggar **efter** att alla lyckats. Om en update misslyckas: bryt, logga inte, returnera fel. Idempotens säkras av att samma `from == to` ger no-op.
- `artist_ownership_log` har FK med `ON DELETE CASCADE` mot `artist_profiles` så raderade artister inte lämnar dangling-loggar — anpassa till `SET NULL` om historik ska bevaras (kan diskuteras).
- Inga ändringar i storage-paths (`artists/{user_id}/...`) — de är bara strängar, RLS på storage gäller bucket-ägarskap inte path-segment.

## Filer som skapas/ändras

- **Migration**: 1 ny SQL-fil (steg 1a + 1b i samma migration).
- **Skapas**: `src/lib/admin-ownership.functions.ts`, `src/lib/admin-ownership-log.functions.ts`, `src/components/AdminOwnershipLog.tsx`.
- **Ändras**: `src/routes/admin.tsx` (reassign-flödet + ny sektion för logg).

## Vad detta INTE gör

- Skickar inget mejl till gamla/nya ägaren (kan läggas till senare i `notifications`-tabellen om du vill).
- Tar inte bort gammal ägares roll/access globalt — bara på den specifika artisten.
- Berör inte `azuracast`-import eller storage-objekt.
