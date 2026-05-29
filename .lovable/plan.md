## Mål

Få upp ljudfilen direkt så användaren börjar med att dra in låten/låtarna — sedan byggs release-metadatan upp runt det.

## Ny stegordning

Nuvarande: Release Details → Platforms → Tracks → Rights → Review
Ny: **Tracks → Release Details → Platforms → Rights → Review**

Steg 1 ("Tracks") blir landningen — drag-and-drop-zonen för audio syns direkt när man öppnar Submit Music, och uppladdningarna till storage startar omedelbart i bakgrunden medan användaren fyller i resten.

## Varför det fungerar tekniskt

Uppladdning av ljudfiler i `StepTracks` kräver bara `user.id` (filen läggs på `audio/<uid>/release-…`). Den behöver varken `artistProfileId`, titel eller albumrad — `submissions`-raden för varje låt skapas först vid "Skicka in" (`submitRelease`). Autosparet av albumutkastet kräver fortfarande titel + artist och triggas helt enkelt först när användaren fyllt i steg 2.

## Ändringar i `src/components/release-wizard/ReleaseWizard.tsx`

1. **`STEPS`-arrayen (rad ~255)** — byt ordning så att `Tracks` (FileMusic-ikon) blir id 1, `Release Details` id 2, `Platforms` id 3, `Rights` id 4, `Review` id 5.
2. **Render-switchen (rad ~588)** — flytta så att `step === 1` renderar `<StepTracks>`, `step === 2` renderar `<StepReleaseDetails>` (med `onArtistCreated`-prop intakt), `step === 3` `<StepPlatforms>`, `step === 4` `<StepRights>`, `step === 5` `<StepReview>`.
3. **`validate()` (rad ~687)** — flytta valideringsreglerna till motsvarande nya nycklar: track-reglerna under `e[1]`, release-detaljerna under `e[2]`, plattformar `e[3]`, rättigheter `e[4]`.
4. **Step header-copy i `StepTracks`** — uppdatera ev. text som antyder att man kommit hit "efter" detaljerna, så landningstexten blir välkomnande ("Ladda upp dina låtar för att börja").
5. Inga ändringar i state-shape, reducer, autosave-logik, `saveDraft` eller `submitRelease` — endast UI-ordning och validerings­indexering.

## Edge-cases att kolla

- Knappen "Nästa" är disabled tills steg 1 är giltigt: nya regeln blir "minst en låt uppladdad och färdig" istället för "release-detaljer ifyllda". Existerande track-validering (`status !== "ready"`, titel krävs) räcker.
- Progress-indikatorn längst upp i wizarden använder `STEPS`-arrayens ordning och fungerar automatiskt efter ombyte.
- Inga datamigreringar, inga ändringar i Supabase eller i andra routes.
