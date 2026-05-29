# Auto-grant Artist-roll i Skicka in musik

Idag måste en användare som ansöker via `ArtistAccountGate` vänta på admin-godkännande (`approval_status = 'pending'`). Användarens önskemål: när man går genom Skicka in musik och skapar ett nytt artistkonto (eller har ett existerande), ska kontot direkt få status **approved** och användaren få rollen **artist**. Admin kan fortfarande granska och rensa i efterhand.

## Förändringar

### 1. Ny serverfunktion `selfApproveArtistAccount` (server-only, admin-klient)
Fil: `src/lib/artist-self-approve.functions.ts`

- Skyddad med `requireSupabaseAuth` (kör som inloggad användare, hämtar `userId`).
- Indata (zod-validerad): antingen `{ mode: "create", name, bio?, website? }` eller `{ mode: "approveExisting", artistProfileId }`.
- Använder `supabaseAdmin` för att kringgå `enforce_artist_approval`-triggern.
- För `create`:
  - Dubblettkontroll mot alla `artist_profiles.name` (samma regel som vid uppladdning) — admin behöver inte denna kontroll, vanliga användare blockeras.
  - Infogar rad med `user_id = userId`, `approval_status = 'approved'`, `reviewed_by = userId`, `reviewed_at = now()`.
- För `approveExisting`:
  - Verifierar att profilen ägs av `userId` och har status `pending` eller `rejected`, sätter den till `approved` med samma stämplar.
- I båda fallen: upsert i `user_roles` av `{ user_id: userId, role: 'artist' }` (ignorera unique-violation).
- Returnerar `{ id, name }`.

### 2. `ArtistAccountGate` använder den nya serverfunktionen
Fil: `src/components/ArtistAccountGate.tsx`

- `ApplicationForm.onSubmit` anropar `selfApproveArtistAccount({ mode: "create", ... })` istället för direkt `supabase.from("artist_profiles").insert(...)`.
- Vid lyckat svar invalideras `["my-artist-accounts", user.id]` och `["editor-role", user.id]` så gaten släpper igenom användaren direkt till `ReleaseWizard` — ingen "Application sent"-skärm behövs längre.
- Om användaren redan har en `pending`/`rejected` profil visas en knapp "Aktivera mitt artistkonto" som anropar `selfApproveArtistAccount({ mode: "approveExisting", artistProfileId })`. Tar bort dagens väntelägesvy för det här flödet (admin kan fortfarande nedgradera senare).

### 3. Översättningar
- `src/i18n/locales/sv.json` + `en.json`: nya nycklar för knapparna ("Aktivera artistkontot" / "Activate artist account") och ev. felmeddelande för dubblettnamn (återanvänd `duplicateArtist` om möjligt).

## Det här rör vi inte
- RLS-policyn `Users create own artist profiles` och triggern `enforce_artist_approval` ligger kvar — vanlig direktinsert från klient fortsätter att hamna på `pending`. Endast self-approve-flödet via serverfunktionen ger automatisk approve, vilket gör att admin behåller kontroll utanför Skicka in musik.
- Inga ändringar i admin-vyer; befintliga verktyg räcker för att städa/återkalla roller eller sätta `approval_status = 'rejected'`.

## Tekniska noter
- Server-fn-filen följer mönstret i `src/lib/admin-users.functions.ts` (tunn fil, bara serverfunktioner som importerar `supabaseAdmin`).
- Inga DB-migrationer behövs.
