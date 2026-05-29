# Mål
Ersätt admin-knappen "Svep bort Radio Uppsala-bilder" med ett automatiskt cron-jobb som kontinuerligt rensar bort `/azuracast/`-default-omslagen i bakgrunden.

# Ändringar

### 1. Ny public hook-route
`src/routes/api/public/hooks/sweep-azuracast-artwork.ts`
- POST-handler skyddad med `apikey`-header mot anon-key.
- Kör en batch av track-regen (`/azuracast/`) och en batch av nytt album-regen, max 50 + 50 per körning (snålt för att hålla request-tiden låg och inte slå i AI-credits för fort).
- Använder `supabaseAdmin` direkt + samma helpers från `azuracast-sync.server.ts`-mönstret. Eftersom server-fn:erna kräver `requireSupabaseAuth` kallar vi inte dem direkt — vi extraherar kärnlogiken till en delad server-helper `src/lib/artwork-sweep.server.ts` som både cron-route:n och de befintliga server-fn:erna anropar.

### 2. Refaktor: bryt ut kärn-loop
Flytta loop-koden från `bulkRegenerateTrackArtwork` och nya `bulkRegenerateAzuracastAlbumArtwork` (i `src/lib/artwork.functions.ts`) till `src/lib/artwork-sweep.server.ts`:
- `sweepAzuracastTracks(limit)` → returnerar `RegenerateResult`
- `sweepAzuracastAlbums(limit)` → returnerar `RegenerateResult`

De två admin-server-fn:erna blir tunna wrappers som bara verifierar admin-roll och kallar helpern. Cron-route:n kallar helpern direkt.

### 3. Schemalägg jobbet
Via `supabase--insert` (inte migration), kör `cron.schedule` som anropar hook:en var 15:e minut:
```sql
select cron.schedule(
  'sweep-azuracast-artwork',
  '*/15 * * * *',
  $$ select net.http_post(
    url:='https://project--8df07df4-e341-41a2-8bd7-3e21b22fe6eb.lovable.app/api/public/hooks/sweep-azuracast-artwork',
    headers:='{"Content-Type":"application/json","apikey":"<anon>"}'::jsonb,
    body:='{}'::jsonb
  ) $$
);
```

### 4. Ta bort knappen
I `src/components/AdminAutoArtwork.tsx`:
- Ta bort "Svep bort Radio Uppsala-bilder"-kortet, sweep-handlern och tillhörande state (`sweep`-varianten i `busy`/`ResultState`).
- Lägg in en liten info-rad i bef. AzuraCast-sektionen: "Körs automatiskt var 15:e minut i bakgrunden."

# Filer som rörs
- **Nytt:** `src/lib/artwork-sweep.server.ts`, `src/routes/api/public/hooks/sweep-azuracast-artwork.ts`
- **Ändras:** `src/lib/artwork.functions.ts` (server-fn:er blir wrappers), `src/components/AdminAutoArtwork.tsx` (knapp bort)
- **Cron:** `supabase--insert` schemalägger jobbet

Inga DB-migrations, inga nya secrets.
