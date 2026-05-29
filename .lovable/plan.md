# Slutför API-leveransen

Backend och endpoints är på plats. Det som återstår är användargränssnittet så att artister och admin faktiskt kan skapa/återkalla nycklar, samt en riktig Swagger UI och en länk dit.

## 1. Personliga API-nycklar i Inställningar

Ny sektion i `src/routes/settings.tsx` (under språkblocket):

- Lista nuvarande nycklar: etikett, prefix (`cm_live_xxxx…`), scopes, skapad, senast använd, status (aktiv/återkallad/utgången).
- Knapp "Skapa ny nyckel" → dialog (shadcn `Dialog`):
  - Fält: etikett (krav), scopes (checkboxar begränsade till `USER_ALLOWED_SCOPES`), valfritt utgångsdatum.
  - Vid skapande visas plaintext-nyckeln **en gång** med "Kopiera"-knapp och varning att den inte kan visas igen.
- "Återkalla"-knapp per nyckel → bekräftelsedialog → sätter `revoked_at`.
- All data via befintliga `src/lib/api-keys.functions.ts` (lägg till `listMyApiKeys`, `createApiKey`, `revokeApiKey` om de saknas; INSERT/UPDATE körs via `supabaseAdmin` i servern eftersom RLS blockerar direkt insert).
- i18n-strängar i `sv.json`/`en.json` under `settings.apiKeys.*`.

## 2. Tjänste-nycklar i Admin

Ny flik/sektion i `src/routes/admin.tsx` ("API-nycklar"):

- Lista alla nycklar (admin ser alla via RLS), filterbar på typ (user/service).
- Skapa **tjänste-nyckel**: etikett (t.ex. "Radio Uppsala"), scopes (alla `ALL_SCOPES` tillåtna inkl. `admin:*` och `read:audio:master`), valfri ägar-koppling (`owner_user_id` — om satt, scopas dataåtkomst till den användarens innehåll; annars global tjänst), utgångsdatum.
- Återkalla valfri nyckel.
- Plaintext visas en gång vid skapande, samma flöde som ovan.
- Skyddas av `useEditorRole`/admin-check som övriga adminblock.

## 3. Riktig Swagger UI på `/api-docs`

Ersätt nuvarande `src/routes/api-docs.tsx` (som är en statisk lista) med interaktiv Swagger UI:

- Lägg till `swagger-ui-react` + `swagger-ui-react/swagger-ui.css` via `bun add`.
- Rendera `<SwaggerUI url="/api/openapi" />` i en client-only wrapper (dynamisk `lazy`/`useEffect` mount för att undvika SSR-krasch — Swagger UI rör `window`).
- Behåll en kort introtext på svenska/engelska ovanför: "Open endpoints kräver ingen nyckel. Skyddade endpoints kräver `Authorization: Bearer cm_live_…`".
- Verifiera att `openapi-spec.ts` listar alla nuvarande endpoints (public + v1) med rätt `security`-block så "Authorize"-knappen i Swagger fungerar.

## 4. Länkar och navigation

- Footer i `src/routes/__root.tsx` (eller där footer ligger): lägg till "API" → `/api-docs`.
- I Inställningar: kort länk "Se API-dokumentation" under nyckelsektionen.
- I Admin-fliken: samma länk + en notering om att tjänste-nycklar ska delas säkert (1Password e.dyl.).

## 5. Tekniska detaljer

- `src/lib/api-keys.functions.ts`: säkerställ tre server-functions
  - `listApiKeys({ scope: 'mine' | 'all' })` (admin krävs för `all`).
  - `createApiKey({ type, label, scopes, expiresAt, ownerUserId? })` — validerar att icke-admin bara får `type='user'` och scopes ⊂ `USER_ALLOWED_SCOPES`; returnerar `{ plaintext, key }`.
  - `revokeApiKey({ id })` — admin kan återkalla alla, user bara egna.
- Alla skrivningar via `supabaseAdmin` efter `requireSupabaseAuth` (RLS tillåter inte INSERT/DELETE).
- Inga schemaändringar krävs — `api_keys`-tabellen täcker redan allt.

## Leverans i ordning
1. Server-functions för CRUD (om något fattas).
2. Settings → API-nycklar (UI + i18n).
3. Admin → Tjänste-nycklar (UI + i18n).
4. Swagger UI på `/api-docs`.
5. Footer-länk + tvärlänkar.

## Öppna frågor (svara gärna före bygget)
1. **Tjänste-nyckel + ägare:** Ska en tjänste-nyckel kunna kopplas till en specifik artist/användare (så att Radio Uppsala bara når den artistens data), eller alltid vara global och styras enbart av scopes?
2. **Utgångsdatum:** Default ingen utgång, eller föreslå t.ex. 1 år för personliga nycklar?
3. **Swagger-tema:** Standard Swagger UI-stil, eller ska vi försöka matcha appens mörka/ljusa tema (kräver lite custom CSS)?