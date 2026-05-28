## Mål

Submit-knappen (musik) ska synas för **alla** i menyn. Klickflödet:

1. **Inte inloggad** → skickas till inloggning först.
2. **Inloggad utan godkänt artistkonto** → får fylla i sina uppgifter och **ansöka** om ett artistkonto.
3. **Ansökan måste godkännas av admin** innan man kan skicka in musik.

Submit förblir enbart för musik (flödet sätter redan `media_type = "music"`).

## Databas (migration)

Lägg till godkännandestatus på `artist_profiles`:

- Ny enum `artist_approval_status` med värdena `pending`, `approved`, `rejected`.
- Ny kolumn `approval_status` (default `pending`, ej null) samt `reviewed_by`, `reviewed_at` och `rejection_reason`.
- **Backfill:** alla befintliga artistprofiler sätts till `approved` så katalogen är oförändrad.
- **Trigger** som skyddar mot självgodkännande:
  - Vid skapande tvingas status till `pending` för icke-admins.
  - Vid uppdatering kan endast admin ändra `approval_status` (icke-admins får statusfältet återställt till tidigare värde).
- Admin kan redan läsa/uppdatera alla artistprofiler via befintliga RLS-regler.

## Frontend

**Menyn (`SiteHeader.tsx`)**
- Flytta Submit-länken ut ur det inloggade blocket så den alltid visas (både desktop och mobil). Själva inloggningskravet hanteras av målsidan.

**Submit-sidan (`releases.new.tsx` + ny gate)**
- Sidan ligger kvar bakom `ProtectedRoute` (ej inloggad → `/login`).
- Ny komponent `ArtistAccountGate` runt wizarden som hämtar användarens artistprofiler med status:
  - **Har godkänd profil** → visa release-wizarden som vanligt.
  - **Har bara väntande ansökan** → visa meddelande "Din ansökan granskas av admin".
  - **Har ingen profil** → visa ansökningsformuläret (namn, bio, webbplats/länkar) med tydlig text om att kontot godkänns av admin. Skapar en profil med status `pending`.

**Release-wizarden (`ReleaseWizard.tsx`)**
- Artistlistan filtreras till endast `approval_status = 'approved'`.

**Ansökningssida (`artists.new.tsx`)**
- Uppdateras till "Ansök om artistkonto": skapar en väntande profil och visar bekräftelse om att admin måste godkänna (istället för att direkt navigera till artistsidan).

**Admin (`ArtistsAdmin` i `admin.tsx`)**
- Hämta även `approval_status`.
- Lägg en sektion överst för **väntande ansökningar** med Godkänn/Avslå-knappar (sätter status, `reviewed_by`, `reviewed_at`, ev. avslagsorsak).
- Visa statusetikett på varje artist i listan.

## Teknisk detalj

- Självgodkännande förhindras i databasen via trigger, inte bara i UI:t — en inloggad användare kan annars sätta `approved` själv via API:et.
- Publika katalog-/artistsidor påverkas inte: väntande artister har inga godkända släpp och syns därför inte publikt.

## Verifiering

- Utloggad: Submit syns → klick leder till inloggning.
- Inloggad utan profil: ser ansökningsformulär → ansökan skapas som `pending`.
- Pending-konto: ser "under granskning", kan inte nå wizarden.
- Admin: ser väntande ansökan, godkänner → användaren kan nu skicka in musik.
- Befintliga artister i katalogen fungerar oförändrat (approved).
