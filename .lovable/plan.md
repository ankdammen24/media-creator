## Vad som ska fixas

Tre småfix för att kunna förvalta artister och album i efterhand.

### 1. Redigera artist i efterhand (även som admin)

På `/artists/$artistId` visas knappen "Redigera profil" och bildhanteraren bara när inloggad användare äger profilen (`profile.user_id === user.id`). Admins ser ingen knapp.

**Ändring:** Slå även på `canEdit` när användaren har rollen `admin`. Hämta admin‑status i samma query (samma mönster som `albums.$albumId.tsx` redan använder). Då blir `ArtistProfileEditor` + `ArtistImageManager` (inkl. AI‑bilder) tillgängliga för admins och ägaren även efter att artisten skapats.

Backend behöver inget nytt — RLS på `artist_profiles` och `artist_images` tillåter redan både ägare och admin.

### 2. AI‑bilder och bildbyte i efterhand

Faller ut automatiskt av punkt 1: `ArtistImageManager` (knapparna "Skapa med AI", "Variera med AI", ladda upp, ta bort, sätt primär, byt typ) renderas så snart `editing && canEdit` är sant. Inget nytt UI behövs — bara gaten som öppnas i punkt 1.

### 3. Skapa album i efterhand och samla låtar i det

Knappen för att skapa album finns redan (`/albums/new`), men det är svårt att hitta och det går inte att flytta in befintliga låtar.

**A. Genväg till "Skapa album"**

Lägg till en "Skapa album"‑knapp:
- På `/my-submissions` högst upp (länk till `/albums/new`).
- På `/artists/$artistId` när `canEdit` är sant — länk till `/albums/new` med `?artistId=<id>` så att `AlbumForm` förväljer rätt artist (utökar `AlbumForm` att läsa `artistId` från search params som default).

**B. Lägg till befintliga låtar i ett album**

På `/albums/$albumId`, när `canEdit`, lägg till en ny sektion "Lägg till låtar":
- Lista alla submissions som tillhör albumets `artist_profile_id` och som ännu inte har något `album_id` (eller är kopplade till ett annat album om vi vill tillåta flytt — vi börjar med "inga `album_id`"). Filtreras till submissions som användaren får se via RLS.
- Checkbox‑lista + knapp "Lägg till valda". Vid klick: för varje vald submission, `UPDATE submissions SET album_id = <album.id>, track_number = <nästa lediga>`. Återanvänd `nextTrackNumber` från `src/lib/album-helpers.ts` (kör sekventiellt för att undvika kollisioner).
- Efter sparat: invalidate album‑query.

**C. Byta album på en submission**

I `EditSubmissionDialog` (`src/components/SubmissionActions.tsx`): lägg till ett "Album"‑fält (select över ägarens album för aktuell artist, plus "Inget album"). Vid spar uppdateras `album_id` och `track_number` (sätts till nästa lediga om ett nytt album väljs, annars nollas). DB‑triggern `check_submission_album_artist` säkerställer att albumets artist matchar.

## Filer som ändras

- `src/routes/artists.$artistId.tsx` — hämta admin‑status, utvidga `canEdit`.
- `src/routes/my-submissions.tsx` — "Skapa album"‑knapp.
- `src/components/AlbumForm.tsx` — läs `artistId` från search params som default.
- `src/routes/albums.new.tsx` — typad search‑validator för `artistId`.
- `src/routes/albums.$albumId.tsx` — ny "Lägg till låtar"‑sektion (admin/ägare).
- `src/components/SubmissionActions.tsx` — album‑select i `EditSubmissionDialog`.

Inga DB‑migrationer behövs.
