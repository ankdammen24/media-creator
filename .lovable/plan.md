### Uppgift
På Om-sidan ska följande fyra entitetsnamn vara klickbara länkar till sina respektive webbplatser:
- **Media Rosenqvist** → `https://mediarosenqvist.com`
- **Crystal Pier Records** → `https://crystalpierrecords.org`
- **Guerilla Minstrel Publishing** → `https://guerillaminstrel.com`
- **Radio Uppsala** → `https://radiouppsala.se`

### Förändringar
1. **`src/routes/about.tsx`**
   - Lägg till `Trans` från `react-i18next`.
   - Skapa fyra länkkomponenter/konstanter med konsekvent styling (`text-primary hover:underline`).
   - Uppdatera introduktionen så att `intro1Bold2` ("Media Rosenqvist") är en länk inuti `<strong>`.
   - Gör varje sektionsrubrik (`about.mr.heading`, `about.cpr.heading`, `about.gmp.heading`, `about.ru.heading`) till en klickbar länk.
   - Ersätt alla stycken som innehåller ett entitetsnamn (t.ex. `about.mr.p1`, `about.cpr.p1`, `about.gmp.p1`, `about.ru.p1` m.fl.) med `<Trans>`-komponenter som interpolerar länken via `<0>`-platshållare.
   - Ersätt det hårdkodade ASCII-diagrammet över ekosystemet med JSX där varje entitetsnamn är en klickbar länk.

2. **`src/i18n/locales/sv.json`**
   - Uppdatera alla `about.*`-översättningsnycklar som innehåller ett entitetsnamn så att namnet omsluts av `<0>…</0>` (t.ex. `"p1": "<0>Media Rosenqvist</0> är den…"`).
   - Rubriker behöver inte ändras eftersom texten fortfarande läses via `t()` och länken läggs i JSX.

3. **`src/i18n/locales/en.json`**
   - Samma uppdateringar som sv.json ovan.

### Leverans
Inga nya beroenden. Bygget verifieras efter ändringarna.