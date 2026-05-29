# Rebrand: Media Rosenqvist Catalog → Catalogus Musicus

Kosmetiskt namnbyte på tjänsten. "Media Rosenqvist" som moderbolag/ekosystem (About-sidan, organisationsnamn) lämnas orört.

## Ny logga

Generera en ny logga via imagegen (premium, transparent bakgrund):
- **Stil:** serif-monogram "CM" sammanflätat, varm guld/mässing-ton på mörk/neutral bakgrund, klassisk katalog- och bibliotekskänsla (think antikvariatets ex libris-stämpel).
- **Filer:** `src/assets/logo-cm.png` (kvadratisk, ~512px, transparent PNG) + en favicon-vänlig variant `public/logo-cm-128.png`.
- Gamla `public/logo-mr.png` / `logo-mr-128.png` lämnas kvar i public/ men slutar refereras.

## Textbyten (tjänstens namn)

Endast strängar som syftar på katalog-**tjänsten** byts. "Media Rosenqvist" som företagsnamn i About-sektionen, ekosystem-prosan och copyright behålls.

**Komponenter / routes:**
- `src/components/SiteHeader.tsx`: importera ny logga, alt-text, span-text "Catalogus Musicus", footer-© byts till "© {year} Catalogus Musicus · ett Media Rosenqvist-projekt".
- `src/routes/__root.tsx`: site-wide meta (title, description, og:title, og:description, twitter:*, og:site_name, ev. JSON-LD WebSite/Organization name) → "Catalogus Musicus". Author-meta får stå kvar som "Media Rosenqvist".
- `src/routes/index.tsx`: title + og-meta → "Catalogus Musicus — Music catalog & podcasts" och uppdaterad beskrivning ("Browse the Catalogus Musicus catalog, by Media Rosenqvist.").
- `src/styles.css`: kommentaren "/* Media Rosenqvist — … */" → "/* Catalogus Musicus — … */".

**i18n (sv + en) — samma nycklar i båda filerna:**
- `tagline`, `intro1Bold2`, hero/landing-rubriker som idag säger "Media Rosenqvist" och syftar på tjänsten → "Catalogus Musicus".
- Alla förekomster av frasen "Media Rosenqvist Catalog" → "Catalogus Musicus" (upload, upload-batch, releases.new, albums.new, notifieringar, podcast-flöden m.m.).
- About-sektionens nycklar (`heading`, `p1`, `p4` etc.) lämnas orörda — där beskrivs moderbolaget.

**Notification-mallar:**
- `src/lib/notification-content.ts` och `src/lib/notifications.functions.ts`: alla strängar som säger "Media Rosenqvist Catalog" → "Catalogus Musicus". Mottagar-/avsändarnamn som refererar till bolaget lämnas.

## Verifiering
- Snabb `rg "Media Rosenqvist Catalog"` efteråt → ska ge 0 träffar.
- `rg "Media Rosenqvist"` ska bara matcha About-sidan, ekosystem-prosan, footerns "ett Media Rosenqvist-projekt", og:author och liknande avsiktliga referenser.
- Visuell QA i preview: header visar ny logga + "Catalogus Musicus", flikens titel uppdaterad, footer korrekt.

## Tekniska detaljer
- Inget DB- eller backend-arbete. Rena frontend-/copy-/asset-ändringar.
- Hydration-mismatch-varningen från headern ("Hem"/"Home") är orelaterad och hanteras inte här.
- Custom-domänen `catalog.mediarosenqvist.com` byts inte.
