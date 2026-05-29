## Mål
Översätt hela appen till svenska och engelska. Svenska som standard om browserns språk inte är `en*`. Användaren kan byta i headern; valet sparas på profilen för inloggade.

## Bibliotek
`react-i18next` + `i18next` + `i18next-browser-languagedetector`. Stabilt, react-native-vänligt, ingen build-magi. Inga server-renderingsproblem (klient-only init räcker — appen är CSR i praktiken).

## Arkitektur

```
src/i18n/
  index.ts              -- initierar i18next, exporterar `i18n`
  detector.ts           -- liten wrapper som först kollar profiles.preferred_language, sedan localStorage, sedan navigator.language
  locales/
    sv.json
    en.json
```

- En enda flat-key-fil per språk (ex. `"header.submitMusic": "Skicka in musik"`). Lättare än namespaces för en app av den här storleken.
- `<html lang>` uppdateras via `useEffect` på språkändring i `__root.tsx`.

## Språkväljare

- **Header (`SiteHeader.tsx`)**: liten segmented toggle `SV | EN` bredvid profile/notifications. Synlig även för utloggade.
- **Settings**: behåller dropdown — ändrar `i18n.changeLanguage()` OCH skriver `profiles.preferred_language`.
- Vid inloggning hämtas `profiles.preferred_language` och `i18n.changeLanguage()` körs. Vid utloggning fallback till detector-värdet.

## Persistens

- Inloggad: `profiles.preferred_language` är sanningen → skriver vid byte.
- Utloggad: `localStorage.i18nextLng` cachar valet.
- Initial detection: `navigator.language.startsWith("en")` → `en`, annars `sv`.

## SEO / `head()`
Route-titlar i `head()` körs utan tillgång till React-context. För nu lämnar vi `head().meta.title` på engelska (som idag) och översätter all **synlig sidkopia**. När i18n är på plats kan vi i nästa steg läsa språk från cookie i en `beforeLoad` och returnera översatt titel — utanför detta scope.

`<html lang>` uppdateras dock dynamiskt så skärmläsare och Chrome translate beter sig rätt.

## Översättningsarbete (allt på en gång)

Filer som har synlig text (jag går igenom var och en, extraherar strängar till `sv.json` + `en.json`, och byter ut hårdkodad text mot `t("…")`):

**Routes** (18 st)
`index.tsx`, `about.tsx`, `catalog.tsx`, `login.tsx`, `settings.tsx`, `notifications.tsx`, `my-submissions.tsx`, `upload.tsx`, `upload-batch.tsx`, `releases.new.tsx`, `albums.new.tsx`, `albums.$albumId.tsx`, `albums.$albumId.edit.tsx`, `artists.new.tsx`, `artists.$artistId.tsx`, `admin.tsx`, `__root.tsx`.

**Komponenter med UI-text**
`SiteHeader`, `ProtectedRoute`, `ArtistAccountGate`, `ShowPicker`, `AlbumPicker`, `AlbumForm`, `ArtistImageManager`, `ArtistProfileEditor`, `SubmissionActions`, `TrackCard`, `EditorCardMeta`, `GlobalSearch`, `StateViews`, `SourceBadge`, `EditAlbumDialog`, `AiArtworkDialog`, `AiImageGenerator`, `Admin*`-komponenter, `NowPlaying`, `PreviewPlayer`, `player/MiniPlayer`, `player/PlayButton`, `release-wizard/*` (wizardens fem steg + `ReleaseStatusBadge`, `AdminReleaseActions`).

**Hjälp-libs med användarsynlig text**
`podcast-helpers.ts` (kategori-labels), `release-platforms.ts` (plattformsnamn — egennamn behålls), `album-helpers.ts`, `notification-content.ts` (e-postmallar — se nedan).

**Toast/alert-meddelanden**: `window.alert(...)`, `setError(...)`, `throw new Error("...")`-strängar som visas i UI byts till `t("errors.…")`. Server-thrown errors översätts inte (de visas redan via `error.message`).

## E-post (`notification-content.ts`)
Funktionen tar redan emot `language: "sv" | "en"`. Säkerställer att alla typer har båda språk-blocken och att `notifications.functions.ts` skickar med rätt språk baserat på `profiles.preferred_language`. Redan delvis byggt — granskar och fyller luckor.

## Strängar som INTE översätts
- Egennamn: "Media Rosenqvist Catalog", "Spotify", "Apple Music", "Crystal Pier Records", "Submit Music"-knappen får behålla "Submit Music" om vi vill, eller översättas till "Skicka in musik". **Default: översätt allt utom egennamn på företag/plattformar.**
- Data från databasen (titlar, beskrivningar) — det är användarinnehåll, inte UI.
- Konsolen / loggar.

## Genomförande i ordning
1. Installera `i18next react-i18next i18next-browser-languagedetector`.
2. Skapa `src/i18n/` med init, detector och tomma locale-filer.
3. Initiera i `src/router.tsx` (importera så det körs före React mountar) och uppdatera `<html lang>` i `__root.tsx`.
4. Lägg språkväljare i `SiteHeader` + koppla `auth.tsx` så `preferred_language` hydratas vid sign-in.
5. Översätt route-för-route och commit-bart sätt — börjar med `SiteHeader`, `__root`, `index`, `login`, `catalog`, sedan resten.
6. Gå igenom alla komponenter i ordning ovan.
7. Verifiera genom att växla SV↔EN i headern på varje större sida (jag tar screenshots med browsertools på key routes).

## Edge-cases
- `nextEpisodeNumber`-meddelanden och liknande formatterar med interpolation — använder i18next `{{count}}`-syntax.
- Datumformat: `toLocaleDateString(lang === "sv" ? "sv-SE" : "en-GB")` på platser där vi formaterar.
- Plural: i18next har `_one/_other`-stöd; använder där det behövs (ex. "1 track" / "5 tracks").
- Lazy-byte under skrivning av formulär: state behålls, bara labels byts.

## Inte i detta steg (uppmärksamma användaren)
- Översätta `head().meta.title` per route (kräver context-läsning i loaders) — kan göras separat efteråt.
- Översätta innehåll skapat av användare (artistbio, låttitlar etc.).
- Lokaliserade URL:er (`/about` vs `/om-oss`) — behåller engelska routes.
