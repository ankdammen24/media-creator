## Mål

På startsidan ska listan under **Latest music** och **Featured artists** bytas ut lite slumpmässigt automatiskt var 5:e minut, så att sidan känns levande utan att man behöver ladda om.

## Så fungerar det

Idag hämtas exakt de 8 senaste godkända låtarna (och 8 senaste artisterna) och visas alltid i samma ordning. Istället:

1. Vi hämtar en **större pool** (t.ex. de 30 senaste godkända låtarna respektive ~24 artister).
2. Vi blandar poolen slumpmässigt och visar **8 stycken**.
3. En timer som tickar **var 5:e minut** triggar en ny blandning, så urvalet byts ut "lite randomly" – helt på klientsidan, inga omladdningar och ingen backend behövs.

Eftersom poolen är begränsad till de senaste posterna håller vi det fortfarande relevant (nya låtar/artister kommer med), men ordningen och vilka 8 som syns roterar.

## Tekniska detaljer

I `src/routes/index.tsx`:

- **`LatestMusic`**: höj `limit(8)` → `limit(30)` i frågan. Lägg till en `shuffleTick`-state (number) som ökas av en `setInterval(..., 5 * 60 * 1000)` i en `useEffect`. Härled den visade listan med `useMemo(() => shuffle(pool).slice(0, 8), [pool, shuffleTick])`.
- **`FeaturedArtists`**: samma mönster – behåll dedupliceringen men bygg en större unik artistpool (t.ex. upp till 24), och plocka slumpmässigt 8 som roterar var 5:e minut via samma `shuffleTick`-mekanism.
- Lägg till en liten `shuffle`-hjälpfunktion (Fisher–Yates) i filen.

Intervallet städas upp i `useEffect` cleanup. Allt är ren frontend/presentation – inga ändringar i databas, queries-struktur eller affärslogik utöver den ökade `limit`.
