## Mål

En 2,5 sekunders crossfade mellan musiklåtar i spelaren — både när en låt tar slut av sig själv och när man trycker nästa/föregående. Poddavsnitt byter direkt (ingen fade).

## Bakgrund

Spelaren (`src/components/player/PlayerProvider.tsx`) använder idag **ett** `Audio`-element. En äkta crossfade kräver två ljudkällor som överlappar, så provider:n byggs om till en "två-deck"-modell.

## Ändringar (endast `PlayerProvider.tsx`)

**Två ljudelement istället för ett**
- Skapa två `Audio`-element (deck A och deck B). En ref pekar på vilket som är "aktivt" (driver progress/duration/UI).
- Volym-ramp görs på `el.volume` via `requestAnimationFrame` (ingen Web Audio API — undviker CORS-problem med signerade URL:er).

**Crossfade-logik**
- En `crossfadeTo(nextTrack)`-funktion: hämtar signerad URL för nästa låt, startar det inaktiva decket på volym 0, och ramper under 2,5 s — aktiv deck `1 → 0`, ny deck `0 → 1`. När fadeen är klar pausas/nollställs gamla decket och rollerna byts.
- Pågående fade kan avbrytas (avbryt rAF, sätt slutvolymer direkt) så snabba klick inte staplar fades.

**När crossfade triggas**
- *Automatiskt:* via `timeupdate` på aktiva decket — när `currentTime >= duration − 2.5` startas crossfaden till nästa i kön (en guard så den bara körs en gång per låt). Ersätter dagens `ended`-baserade auto-advance.
- *Manuell skip:* `skipNext`/`skipPrev` använder samma `crossfadeTo`.

**Endast musik**
- Om nuvarande eller nästa spår är `mediaType === "podcast"` görs ett hårt byte (som idag) utan fade.
- Låtar kortare än ca 2,5 s, eller sista låten i kön, hanteras med hårt byte/normalt slut.

**Övrigt som måste fortsätta funka**
- `toggle`, `seek` agerar på det aktiva decket.
- `close` stoppar och nollställer båda decken och avbryter ev. fade.
- `progress`/`duration`-state följer alltid aktiva decket; lyssnare flyttas vid deck-byte.
- Mobil autoplay: nästa deck startas i samma uppspelningskedja som redan är igång, så inga nya gesture-krav tillkommer.

## Verifiering

- Lyssna på den slumpade kön på startsidan: kontrollera mjuk 2,5 s-övergång vid låtslut.
- Tryck nästa/föregående mitt i en låt → mjuk övergång.
- Spela en podd → direkt byte utan fade.
- Paus, sök i tidslinjen och stäng spelaren fungerar under och efter en fade.
