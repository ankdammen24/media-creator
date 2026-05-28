Plan:

1. Samla rättighetsmodellen
- Sluta låta frontend avgöra bred redigeringsrätt med `artist`-rollen när databasen bara tillåter ägare/admin.
- Inför en gemensam server-side kontroll för redigering: ägare eller admin, och om vi vill behålla “editor/artist kan redigera katalog” görs det explicit på servern, inte genom osäkra klientuppdateringar.

2. Flytta katalogens Spara-flöden till serverfunktioner
- Skapa/utöka en tunn `catalog-edit.functions.ts` med skyddade serverfunktioner för:
  - uppdatera artistprofil
  - uppdatera album
  - uppdatera låt/submission
  - koppla/lossa låt till album och sätt track number
  - uppdatera artwork-path efter bildbyte
- Serverfunktionerna använder inloggad användare, verifierar behörighet och skriver sedan kontrollerat så RLS inte stoppar legitima admin/editor-flöden.

3. Rätta befintliga formulär
- `AlbumForm`: vid edit ska inte `user_id` skrivas om till den som klickar Spara; ägarskapet ska behållas.
- `ArtistProfileEditor`: byt direkt `supabase.update` mot serverfunktionen.
- `EditSubmissionDialog`: byt direkt `supabase.update` mot serverfunktionen.
- `ReplaceArtworkButton` och AI-bildsparning för låtar: behåll uppladdning i storage men låt servern spara databaskolumnen.
- `AddTracksSection`: byt direkt uppdatering av `album_id`/`track_number` mot serverfunktion.
- Gå igenom `ArtistImageManager` eftersom den också har flera Spara/Edit-liknande operationer mot `artist_images`.

4. Gå igenom alla Edit-knappar och gör flödet konsekvent
- Albumdetalj: Edit album ska gå till samma säkra albumform.
- Artistsida: Redigera profil, singel-edit och diskografi-edit ska använda samma dialog/serverfunktioner.
- Albumsida: track-edit ska använda samma `EditSubmissionDialog` och samma serverfunktion.
- Adminsida: submission-edit ska återanvända samma säkra komponent/flöde där det går.
- Dölj Edit-knappar när användaren saknar verklig serverbehörighet, så användaren inte kommer till ett Spara som ändå nekas.

5. Databas/RLS
- I första hand undviker vi bredare RLS genom serverfunktioner med strikt behörighetskontroll.
- Om nuvarande produktregel verkligen är att `artist`-rollen ska kunna redigera all katalogdata, lägger vi en liten migration som gör RLS-reglerna konsekventa med det. Annars begränsar vi UI till ägare/admin.

6. Validering
- Testa samtliga Spara/Edit-flöden som finns i koden: artistprofil, album, låt, track-to-album, artwork och admin-edit.
- Kontrollera att felet “new row violates row-level security policy” försvinner och att ägarskap inte ändras av misstag.