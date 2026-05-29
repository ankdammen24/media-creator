## Mål

Ta bort 2,5-sekunders volym-crossfaden. I stället förladdas nästa låt i kö så snart en låt börjar spela, och nästa låt startas automatiskt **0,8 sekunder innan** den pågående tar slut — utan volym-ramp, bara för att täcka det lilla gapet mellan låtar.

## Beteende

- Tryck Play → låt A börjar spela.
- Direkt vid start: nästa låt i kön får sin signed URL hämtad och laddas in på den inaktiva audio-decken (`preload="auto"`, ej `play()`).
- När A når `duration − 0.8s`: den förladdade decken börjar spela på full volym, blir aktiv deck, A pausas direkt.
- Inget volym-ramp åt något håll.
- Skip Next / Skip Prev / Play på ny låt = hård switch (som idag, ingen fade).
- Podcasts och sista låten i kön = ingen pre-load, spelar ut till slut och stoppar.

## Tekniska ändringar (`src/components/player/PlayerProvider.tsx`)

1. **Konstanter**
   - Ta bort `CROSSFADE_SEC` / `CROSSFADE_MS`.
   - Lägg till `GAP_FILL_SEC = 0.8`.

2. **Ta bort fade-rampen**
   - Radera `startFade`, `cancelFade`, `fadeRafRef`, `fadingOutElRef` och alla volume-mutationer (decks står alltid på `volume = 1`).
   - Ta bort `useCrossfade`-flaggan från `goToTrack` och alla anrop.

3. **Förladdning av nästa låt**
   - Ny ref `preloadedRef: { trackId, url } | null`.
   - I `goToTrack` (efter att aktiv deck börjat spela): titta på `queueRef.current[0]`. Om den finns och är `music`, hämta signed URL via `signedUrlFor`, sätt `inactiveDeck.src = url`, `inactiveDeck.preload = "auto"`, `inactiveDeck.load()`, spara i `preloadedRef`. Gör inget om nästa redan är förladdad.
   - Om kön ändras (skip, ny play, queue-rebuild) → invalidera `preloadedRef` och rensa inaktiv decks `src` när den inte matchar nytt nästa.

4. **Auto-start vid duration − 0,8s**
   - Ersätt `maybeAutoCrossfade` med `maybeStartNextEarly`: när `el.duration − el.currentTime ≤ GAP_FILL_SEC`, `currentRef.current.mediaType === "music"`, kö-första är `music` och matchar `preloadedRef.trackId`, och `fadeGuardRef`-motsvarigheten inte redan triggat för denna låt:
     - Markera triggad (samma guard-mönster).
     - Flytta `current → history`, `queue.shift()`.
     - Byt `activeIdxRef` till inaktiv deck, `setCurrent(next)`, kör `inactiveDeck.play()`.
     - Pausa den nu inaktiva (gamla) decken direkt efter att den nya kommit igång (samma tick) — det ger ~0,8s overlap där båda spelar utan volymjustering.
     - Rensa `preloadedRef` och starta ny förladdning av nästkommande låt.

5. **`onEnded`** behåller nuvarande beteende som fallback (för fall där nästa-låten inte hann laddas / podcasts / kort spår). Hård switch utan fade.

6. **`skipNext` / `skipPrev`** = `goToTrack(next, { keepQueue: true })` utan crossfade-argument; invalidera förladdning och starta om för nya nästa.

## Filer

- `src/components/player/PlayerProvider.tsx` (enda filen som behöver ändras).

## Risker / kantfall

- Spår kortare än 0,8s: villkoret triggar aldrig, `onEnded` tar hand om övergången.
- Signed URL-cache används redan → ingen extra Supabase-trafik vid själva övergången.
- `inactiveDeck.play()` är användarinitierad (vi är i en kedja efter ursprungligt Play-klick), så autoplay-policyn blockerar inte.
