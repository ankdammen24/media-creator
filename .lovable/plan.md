# Beta → 1.0 och framåt

## 1. Vad ligger i `.lovable/plan.md` idag

Den existerande planfilen handlar **bara om spelaren**: ta bort 2,5 s volym-crossfade och ersätt med pre-load + auto-start 0,8 s innan låten tar slut (ingen volym-ramp). Den är inte implementerad ännu och hör hemma i v1.0 nedan.

## 2. Versions-roadmap

### v1.0-beta (nu) — stabilisera det som finns
- Bekräfta att hela Submit Music-wizarden fungerar end-to-end (klart).
- RLS-fix på artist-avatar och presskit-bilder (klart).
- Användarvänlig `StorageErrorAlert` vid RLS-block (klart).
- Fixa kvarvarande hydration-mismatch i `SiteHeader` (server renderar "Home", klient "Hem" — språk-init körs efter SSR). Liten men synlig.

### v1.0 — "release-ready"
- **Spelaren: pre-load + gap-fill** enligt befintliga `.lovable/plan.md`.
- **Notifikationer**: visa olästa i header, markera som lästa, e-postmall för submission-status.
- **Admin-moderering**: snabb-godkänn / avvisa direkt i listan, batch-actions, sök på artist/titel/UPC/ISRC.
- **Artistprofil offentlig sida**: publik vy med presskit-bilder, släpp och spelade spår.
- **SEO**: unik `head()` per route (artist, album, episode), `og:image` från artwork.

### v1.1 — innehåll & upptäckt
- Album-/release-sida publik med tracklist och spelare.
- Sök (artist, låt, podd) med Supabase full-text.
- Spellistor / kuraterade samlingar (admin-redaktionellt).
- "Spelas nu på radion" widget kopplad till `playback_events` + Azuracast.

### v1.2 — analytics & artistverktyg
- Artist-dashboard: antal spelningar, topplåtar, geografisk spridning (om vi loggar det).
- Export av rapporter (CSV) per period.
- Submission-historik med diff mot godkänd version.

### v1.3+ — community & monetisering (utforska)
- Följ artist / favoriter för inloggade lyssnare.
- Donationer/tips via Stripe eller Lovable Payments.
- Podd-RSS-export.
- Publikt API (`/api/public/*`) för partners.

## 3. Nästa prioriterade steg (förslag att börja med direkt)

Rangordnat efter värde/effort:

1. **Hydration-fix i header** (liten, syns i konsolen redan nu).
2. **Spelarens pre-load + gap-fill** (planen finns, en fil).
3. **Publik artistprofil-sida** (låser upp delning + SEO-värde).
4. **Notifikationer i UI** (tabellen finns, bara front-end + en serverFn).
5. **Admin batch-moderering** (sparar mest tid på sikt).

## 4. Vad jag behöver veta

- Vilken av v1.0-punkterna vill du börja med? Förslag: 1 + 2 i samma iteration eftersom båda är små.
- Ska roadmapen sparas som `.lovable/roadmap.md` så vi har den versionerad i repot?
