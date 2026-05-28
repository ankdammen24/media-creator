## Två delar

### 1) Flera artister per submission

Idag har `submissions` ett enda `artist_profile_id`. Vi vill kunna välja flera (collabs, "feat.").

**Schema** – ny join-tabell:

```sql
CREATE TABLE public.submission_artists (
  submission_id uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  artist_profile_id uuid NOT NULL REFERENCES public.artist_profiles(id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT false,
  position int NOT NULL DEFAULT 0,
  PRIMARY KEY (submission_id, artist_profile_id)
);
```

- GRANT till anon (SELECT), authenticated (full), service_role (ALL).
- RLS: SELECT öppet (raderna pekar bara på godkända/egna submissions, och själva data redan publik via befintliga policies). INSERT/UPDATE/DELETE: ägaren av submission ELLER admin.
- Behåll `submissions.artist_profile_id` som "primary artist" för bakåtkompatibilitet (kataloglistan, sökning, artistsidan visar fortsatt detta som huvudartist).
- Backfill: kopiera in alla existerande `(submission.id, submission.artist_profile_id, is_primary=true)` i join-tabellen.

**UI (upload + upload-batch + admin)**:
- Steg 1 "Choose artist profile" blir multi-select av användarens egna artistprofiler (checkboxar/chips). Första valda = primär (markeras "Primary"). Möjlighet att byta primär.
- Vid submit: skriv `submissions` med primär som `artist_profile_id`, plus insert i `submission_artists` för alla valda.
- Katalogkortet och `/catalog`-sökningen visar primär artist + " feat. X, Y" om fler.
- Artistsidan listar submissions där artisten finns i join-tabellen (inte bara där `artist_profile_id` matchar).

### 2) Artister redigerar sin egen profil

**Schema** – utöka `artist_profiles`:

```sql
ALTER TABLE public.artist_profiles
  ADD COLUMN avatar_path text,
  ADD COLUMN website_url text,
  ADD COLUMN facebook_url text,
  ADD COLUMN instagram_url text,
  ADD COLUMN x_url text,
  ADD COLUMN spotify_url text,
  ADD COLUMN apple_music_url text,
  ADD COLUMN amazon_music_url text;
```

Befintliga UPDATE-policies (ägare + admin) räcker.

**Avatar-lagring**: återanvänd `artwork`-bucketen, sökväg `artists/{user_id}/{artist_id}-{timestamp}.{ext}`. Bucketen är redan publik.

**UI** – på `/artists/$artistId`:
- Visa avatar (rund, fallback initial), bio, samt sociala ikoner (lucide: Facebook, Instagram, Twitter, Music2 för Spotify/Apple/Amazon, Globe för website) som länkar till respektive URL när ifylld.
- Om inloggad användare äger profilen (`profile.user_id === user.id`) → knapp "Redigera profil" som öppnar inline-formulär:
  - Namn (text)
  - Bio (textarea)
  - Avatar (filuppladdning, jpg/png/webp ≤ 5 MB, byts via storage upload + uppdatering av `avatar_path`)
  - 7 URL-fält (website, facebook, instagram, x, spotify, apple_music, amazon_music) — valideras med zod `z.string().url().optional().or(z.literal(""))`, tomt = NULL.
- Spara via `supabase.from("artist_profiles").update(...).eq("id", artistId)` (RLS sköter resten).
- Global sök: ta även med träffar på artister även om deras submissions inte är godkända (nuvarande beteende OK, ingen ändring).

### Filer

- ny migration: `submission_artists`-tabell + GRANT + RLS + backfill + nya kolumner på `artist_profiles`
- ändra: `src/routes/upload.tsx` (multi-select artister + insert i join-tabell)
- ändra: `src/routes/upload-batch.tsx` (samma flöde)
- ändra: `src/routes/admin.tsx` om submissions visas där (lägg till "feat." i listan)
- ändra: `src/routes/catalog.tsx` (visa featured artists på kort)
- ändra: `src/routes/artists.$artistId.tsx` (avatar/sociala länkar + redigeringsformulär för ägare; query bytas till join via `submission_artists`)
- ny komponent: `src/components/ArtistProfileEditor.tsx` (formulär + uppladdning)
- ändra: `src/components/GlobalSearch.tsx` (ev. visa avatar i artist-träffarna)

Inga edge functions; alla ändringar via klient + Supabase RLS.

### Frågor innan implementation

1. **Multi-artist på submission**: ska man kunna välja en artistprofil som tillhör en annan användare (collab med någon annans profil), eller bara sina egna? Förslag: bara sina egna i Steg 1, admin kan länka extra artister via admin-panelen senare.
2. **Avatar-storlek**: är 5 MB / 2048×2048px OK som tak?
