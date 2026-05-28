## Problem

Senaste körningen visar:
- **186 misslyckanden med `download 405`** — AzuraCast returnerar 405 Method Not Allowed på `/file/{id}/download` när on-demand inte är aktiverat på stationen.
- **1434 av 1620 hoppades över som "<40s"** — orimligt högt. Troligen för att AzuraCast returnerar `length: 0` för filer som inte hunnit analyseras, och vår kod tolkar 0 som "kortare än 40s".

## Fix

I `src/lib/azuracast-import.server.ts`:

1. **Byt nedladdningsstrategi till `links.play`** (exakt samma mönster som Radio Uppsala-projektets `azuracast-sync-core.server.ts` använder):
   - Använd `file.links.play` om finns, annars `/api/station/{STATION_ID}/file/{id}/play`.
   - Behåll `X-API-Key`-headern på fetchen.
   - Byt namn på hjälpfunktionen `downloadUrl` → `sourceUrl` så koden matchar referensen.

2. **Skippa bara filer som vi vet är korta**:
   - Nuvarande villkor: `if (file.length != null && file.length < 40) skip`.
   - Nytt villkor: `if (file.length != null && file.length > 0 && file.length < 40) skip`.
   - Effekt: filer med `length: 0` (ej analyserade) går vidare istället för att felaktigt klassas som jinglar.

Inga ändringar i schema, RLS, UI eller artist-/artwork-logiken.

## Verifiering

Efter ändringen kör du "Förhandsvisa (dry run)" igen i adminpanelen. Förväntat:
- "Hoppade över (<40s)" ska sjunka drastiskt (bara riktiga jinglar/FX).
- Sen "Kör import" — `inserted` ska gå upp och `download 405`-felen försvinna.
- Importen är idempotent via `azuracast_unique_id`, så det är säkert att köra igen ovanpå förra körningen.
