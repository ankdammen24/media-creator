
## Mål
En enkel temaväljare (ljust/mörkt/system) med en palett som är skön för ögonen — varken bländande vitt eller djupsvart, mjuk kontrast, konsekvent i hela appen.

## Vad som ändras

### 1. Palett i `src/styles.css`
Idag är `:root` redan mörk och `.dark` har en annan, inkonsekvent palett. Vi rensar upp:

- `:root` = ljust tema (varm off-white bakgrund `oklch(0.985 0.003 90)`, mjuk grafit-text `oklch(0.22 0.01 270)`, dämpade kort/borders — inget rent vitt, ingen ren svart).
- `.dark` = mörkt tema (djupblå-grå `oklch(0.17 0.012 270)`, ljus men inte vit text `oklch(0.93 0.005 270)`, mjuka borders).
- Behåll nuvarande grön primary + lila accent i båda teman (justerad luminans per tema så kontrasten håller WCAG AA).
- Sidebar-tokens synkas med resp. tema (idag är de inverterade).

### 2. Theme-provider
Lägg till `src/components/theme-provider.tsx` (lättviktig, ingen extra dependency):
- Läser val från `localStorage` (`theme` = `light` | `dark` | `system`).
- Default `system` → följer `prefers-color-scheme`.
- Sätter/tar bort klassen `dark` på `<html>`.
- Wrappa appen i `src/routes/__root.tsx`.

### 3. Toggle i header
I `src/components/SiteHeader.tsx` läggs en liten ikon-knapp (sol/måne från `lucide-react`) som cyklar light → dark → system, med `aria-label` och tooltip. Inga andra layoutändringar.

### 4. SSR-säker init
Liten inline-script i `__root.tsx` `<head>` som sätter klassen innan hydration så vi slipper flash.

## Vad som INTE ändras
- Inga komponenter, routes, eller affärslogik rörs.
- Inga nya beroenden.
- Spelare, katalog, admin osv. får automatiskt nya färgerna via tokens.

## Filer som berörs
- `src/styles.css` (rensad palett, två teman)
- `src/components/theme-provider.tsx` (ny)
- `src/components/theme-toggle.tsx` (ny, liten ikon-knapp)
- `src/routes/__root.tsx` (provider + no-flash script)
- `src/components/SiteHeader.tsx` (toggle-knapp)

## Frågor innan jag bygger
1. Standardtema vid första besöket: **följa systemet** (rekommenderas) eller alltid starta i mörkt/ljust?
2. Accentfärgen idag är grön + lila — behålla, eller vill du ha något lugnare (t.ex. dämpad blå)?
