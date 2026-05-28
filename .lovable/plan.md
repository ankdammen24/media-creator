Lgg till tydliga demo-lgesmarkrer i Submit Music-fldet s anvndare inte tror att ltar verkligen skickas till Spotify, Apple Music osv.

## Bakgrund
Submit Music (Release Wizard + Upload) ger idag ett starkt intryck av att vara en riktig distributions-tjnst. Steg 2 heter "Streaming Platforms" med Spotify, Apple Music m.fl. som checkboxar. Rttighetssteget pratar om "streaming platform policies". Framgngsmeddelandena sger bara "submitted for review". Detta kan vilseleda anvndare.

## Plan

### 1. Release Wizard (`/releases/new`) – Demo-banner och omformulerade steg
- Lgg till en persistent **demo-banner**verst i wizardn (orange/gul tonad ruta):
  - "Demo-läge — din release hamnar i Media Rosenqvist Catalog och skickas till Radio Uppsala. Distribution till Spotify, Apple Music m.fl. är inte aktiv."
- **Steg 1 (Release Details)**: uppdatera `description` s det str att allt sparas i Catalog.
- **Steg 2 (Platforms)**: 
  - Byt titel till "Platforms (for future use)" eller liknande.
  - Lgg till en tydlig notis under: "Platform selection is for reference only — actual distribution is not active in demo mode."
  - Kanske gra ut alternativen eller lgga en badge p dem.
- **Steg 4 (Rights)**: omformulera "I understand streaming platform policies" → "I understand this is a demo catalog submission" och "I agree to the distribution terms" → "I agree to the catalog submission terms".
- **Steg 5 (Review)**: under "Distribution"-avsnittet, lgg till en notis om att plattformarna endastr fr referens.
- **Success-skärm**: tydligt skriv:
  - "Release saved to the catalog and submitted to Radio Uppsala for review."
  - "Distribution to streaming platforms is not active — this is a demo submission."

### 2. Upload-sidor (`/upload` och `/upload-batch`)
- Lägg till demo-notis i introtexten p båda sidorna.
- Uppdatera framgångsskärmarna så de tydligt anger att låten hamnar i Catalog + Radio Uppsala, inte Spotify etc.

### 3. My-submissions (`/my-submissions`)
- Lägg till en förklarande text under rubriken om vad "Mine"/submissions innebär i demo-läget.

### 4. Navigation (SiteHeader)
- Lägg till en liten "Demo"-badge bredvid eller på "Submit Music"-knappen i headern.

## Tekniska detaljer
- Använd existerande design tokens (borders, bakgrunder, textfärger).
- För demo-bannern: gul/orange accent (`amber-500` eller motsvarande semantisk token) med border och en Info-ikon.
- Ingen backend-förändring behövs — enbart frontend-text och UI.
- All text på svenska med engelska parenteser där det passar.