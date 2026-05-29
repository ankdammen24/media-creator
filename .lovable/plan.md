**Uppgift:** Flytta podcast-submit från Hero upp i menyn och tydliggör att det är för podcast.

**Ändringar:**

1. **`src/routes/index.tsx`** — Ta bort "Skicka in media"-knappen (den med `/upload`-länk och `UploadCloud`-ikon) från Hero-sektionen. Både i "no data"-läget (ca rad 154) och i "featured music"-läget (ca rad 224).

2. **`src/components/SiteHeader.tsx`** — Ändra den inloggade meny-posten "Ladda upp" (`nav.upload`) till något tydligare. Lägg till en separat tydlig podcast-meny-post bredvid "Skicka in musik" så användaren ser båda alternativen.

3. **`src/i18n/locales/sv.json`** och **`src/i18n/locales/en.json`** — Uppdatera översättningar:
   - Ändra `nav.upload` från "Ladda upp" / "Upload" till "Skicka in podcast" / "Submit Podcast"
   - (Alternativt lägg till ny nyckel `nav.submitPodcast` om vi vill ha båda texterna separat)

**Resultat:** Hero blir renare med bara katalogbläddring. Menyn visar tydligt två separata inlämningsvägar: "Skicka in musik" och "Skicka in podcast".