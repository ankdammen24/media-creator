Plan:

1. Återanvänd edit-dialogen för låtar
- Använd befintliga `EditSubmissionDialog` från `SubmissionActions` för att redigera titel, beskrivning, media type och album.
- Säkerställ att datan som skickas in innehåller alla fält dialogen kräver, även från album- och artistsidorna.

2. Lägg till edit per låt där artister/admin jobbar
- På albumsidan: visa en Edit-knapp per låt när användaren är admin/artist eller ägare.
- På artistsidan: visa Edit-knapp på singel-/låtkort när användaren har behörighet.
- Efter sparning: uppdatera/refetcha aktuell vy så ändringen syns direkt.

3. Rätta ”inget händer”-beteendet
- Se till att klick på Edit inte triggar play på låtkortet.
- Flytta knappens click-hantering så den stoppar bubbling när den ligger inuti klickbara kort.
- Lägg dialogen på sidnivå så den alltid öppnas ovanpå mobilspelaren och annat innehåll.

4. Behörighetsregler i UI
- Admin och artist-rollen får se edit för låtar enligt nuvarande backend-regler.
- Vanlig ägare får se edit för sina egna låtar.
- För övriga användare visas ingen edit-knapp.

Tekniskt:
- Ändra `src/routes/artists.$artistId.tsx` och `src/routes/albums.$albumId.tsx`.
- Eventuellt småjustera `src/components/SubmissionActions.tsx` om knappen behöver stoppa event-propagation eller bli tydligare på mobil.
- Ingen databasändring behövs eftersom RLS redan tillåter update för admin/artist/ägare.