## Mål
Exponera Catalogus Musicus som ett API: öppet för läsning av godkänd katalog, låst (med API-nycklar) för skrivningar, ljudfiler och statistik. Allt dokumenterat via Swagger UI.

## Arkitektur

```text
src/routes/api/
├── public/                  ← bypass av published-site auth, läs-API
│   ├── tracks.ts            GET /api/public/tracks            (list, ?artist, ?album, ?limit, ?cursor)
│   ├── tracks.$id.ts        GET /api/public/tracks/:id
│   ├── artists.ts           GET /api/public/artists
│   ├── artists.$id.ts       GET /api/public/artists/:id       (inkl. diskografi)
│   ├── albums.ts            GET /api/public/albums
│   ├── albums.$id.ts        GET /api/public/albums/:id
│   ├── podcasts.ts          GET /api/public/podcasts
│   └── episodes.$id.ts      GET /api/public/episodes/:id
│
├── v1/                      ← kräver API-nyckel (Authorization: Bearer cm_live_...)
│   ├── submissions.ts       POST  (skapa), GET (lista egna)
│   ├── submissions.$id.ts   PATCH (uppdatera egen draft)
│   ├── albums.ts            POST, GET (egna)
│   ├── albums.$id.ts        PATCH, DELETE
│   ├── audio.$id.ts         GET (signerad URL för master/web)
│   ├── stats.spins.ts       GET (lyssnardata per artist/track)
│   ├── stats.summary.ts     GET (aggregat)
│   └── admin/
│       ├── moderation.ts    GET kö, PATCH godkänna/avslå (kräver admin-scope)
│       └── keys.ts          POST/DELETE (kräver admin-scope)
│
└── docs.tsx                 GET /api-docs  (Swagger UI)
    openapi.json.ts          GET /api/openapi.json
```

### Auth-modell
- **Personliga nycklar** (`type='user'`): skapas från Inställningar → API-nycklar. Scope ärvs från användarens roller (artister kan skriva till egna releaser).
- **Tjänste-nycklar** (`type='service'`): skapas av admin för t.ex. Radio Uppsala. Egna scopes (`read:catalog`, `write:submissions`, `read:audio:master`, `read:stats`, `admin:moderate`).
- **Format**: `cm_live_<32 random bytes base62>`. Endast hashen (SHA-256) lagras i DB. Hela nyckeln visas bara en gång vid skapande.
- **Validering**: middleware läser `Authorization: Bearer`, slår hash i `api_keys`, kollar `revoked_at`/`expires_at`, uppdaterar `last_used_at`, och bifogar `apiKeyContext` (owner_id, scopes, type) till handler.

### Ljudfiler
- `audio`-bucketen förblir privat. `GET /api/v1/audio/:submissionId` returnerar en kortlivad **signed URL** (5 min) via `supabaseAdmin.storage.from('audio').createSignedUrl(...)`. Kräver scope `read:audio:web` eller `read:audio:master`.

### CORS
- `/api/public/*`: `Access-Control-Allow-Origin: *`, bara `GET, OPTIONS`.
- `/api/v1/*`: `Access-Control-Allow-Origin: *` med `Authorization` i `Allow-Headers`, men inga cookies.

### Versionering
- Publika endpoints är ostämplade (`/api/public/...`) — vi lovar bakåtkompatibilitet.
- Skyddade endpoints under `/api/v1/...` — framtida brytande ändringar går i `/api/v2/...`.

## Databas (migration)

```sql
CREATE TYPE api_key_type AS ENUM ('user', 'service');

CREATE TABLE public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash text NOT NULL UNIQUE,
  key_prefix text NOT NULL,            -- t.ex. 'cm_live_abc1' (för UI-visning)
  type api_key_type NOT NULL,
  owner_user_id uuid,                  -- NULL för service-nycklar
  label text NOT NULL,
  scopes text[] NOT NULL DEFAULT '{}',
  expires_at timestamptz,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL
);

CREATE INDEX api_keys_hash_idx ON public.api_keys(key_hash) WHERE revoked_at IS NULL;
```

- RLS: användare ser/raderar egna nycklar; admin ser alla. Insert sker via server function (aldrig direkt från klient — vi måste hasha först).
- GRANT till `authenticated` + `service_role`.

## Server functions / route handlers

- `src/lib/api-keys.functions.ts` — `createApiKey`, `listMyApiKeys`, `revokeApiKey` (med `requireSupabaseAuth`).
- `src/lib/api-auth.ts` (server-only) — `authenticateApiKey(request)` → `{ ownerId, scopes, type }` eller `Response 401`.
- `src/lib/api-scope.ts` — `requireScope(ctx, 'write:submissions')`.
- Varje `/api/v1/*` route-handler: validera input med Zod → `authenticateApiKey` → `requireScope` → utför mot `supabaseAdmin` med uttryckliga WHERE-filter på `owner_user_id` (så att personliga nycklar bara når egna data).

## UI

- **Inställningar → API-nycklar** (`/_authenticated/settings`): lista nycklar, knapp "Skapa ny nyckel" (väljer scope-set), engångsvisning av hela nyckeln, knapp för att återkalla.
- **Admin → Tjänste-nycklar** (`/_authenticated/admin`): samma fast med valbar ägare/label/scopes för externa integrationer.
- **`/api-docs`**: monterar Swagger UI mot `/api/openapi.json`. Använd `swagger-ui-react` (bun add).
- Länk till `/api-docs` i footer.

## Dokumentation
- `src/routes/api/openapi.json.ts` returnerar en handskriven OpenAPI 3.1-spec (en `openapi.ts`-modul med specobjekt, importeras av route + Swagger UI).
- Innehåller alla endpoints, scheman (Track, Artist, Album, Episode, Submission), security schemes (`bearerAuth`), och scopes.

## Säkerhet
- Inga rate-limits i denna iteration (plattformen saknar primitiver).
- Alla `/api/public/*`-svar projicerar endast publika kolumner (ingen `user_id`, `internal_notes`, `processing_*`).
- `service_role`-klienten används bara efter att API-nyckeln verifierats; aldrig direkt från publika endpoints utan WHERE-scoping.
- Audit: `last_used_at` uppdateras async (fire-and-forget) per request.

## Leverans i ordning
1. Migration: `api_keys`-tabell + RLS + GRANT.
2. `api-auth.ts` middleware + `api-scope.ts`.
3. Publika läs-endpoints + OpenAPI-stub.
4. Skyddade endpoints (submissions, albums, audio signed URL, stats).
5. Admin moderation-endpoint.
6. UI för nyckelhantering (user + admin).
7. `/api-docs` med Swagger UI.
8. Footer-länk + verifiering via `invoke-server-function`.

## Frågor som kvarstår (kan klaras efter godkännande)
- Vill du att en personlig nyckel automatiskt får skriv-scope för egna artister, eller ska scope väljas manuellt per nyckel?
- Ska tjänste-nycklar kunna agera "som" en specifik användare (impersonering), eller bara enligt sina egna scopes?