
# New Release Wizard — Crystal Pier Records / Media Rosenqvist

En modern, premium uppladdnings­wizard som ersätter `/upload-batch` och utökar databasen så vi sparar allt det nya flödet samlar in. Designen följer befintligt mörkt graphite-tema med Scandinavian-minimal touch.

## Navigation & routes

- Ny route: `src/routes/releases.new.tsx` — hela wizarden (5 steg).
- `/upload-batch` blir en thin redirect till `/releases/new` så gamla länkar inte dör.
- Lämnar `/upload` (single-track) orörd.
- Sidomeny / CTA pekas om till "New Release" → `/releases/new`.

## Wizard-layout

Sticky vänster-sidebar med stegindikator (på desktop) + bottom progress på mobil. Höger pane är aktivt steg. "Save Draft"-knapp är floating bottom-right hela tiden (autosave var 10 s när det finns ändringar). Smooth fade/slide-transitions mellan steg via Tailwind + Motion.

Steg:

1. **Release Details** — titel, artist (kopplad till `artist_profiles`), label, release date, primary/secondary genre, language, previously released?, cover art drag-and-drop med 1:1-preview + "Skapa med AI"-knapp (återanvänder befintlig `AiArtworkDialog`).
2. **Streaming Platforms** — togglekort för Spotify, Apple Music, YouTube Music, TikTok, Instagram/Facebook, Amazon Music, Deezer, Tidal, Beatport, Pandora. Helper text. Platshållar-ikoner (Lucide), inga riktiga logotyper.
3. **Tracks** — drag-and-drop flera audiofiler (wav/flac/aiff/mp3). Auto-genererar editerbara metadatakort per spår med alla fält i specen. Progress­barer under uppladdning. Track duration läses ur audio via `HTMLAudioElement.duration`.
4. **Rights & Ownership** — fem obligatoriska checkboxar; submit-knapp disablad tills alla är ikryssade.
5. **Review & Submit** — sammanfattningskort (cover, artist, label, datum, plattformar som chips, track-lista, metadata-overview). Två knappar: "Save Draft" och "Submit for Review".

## Statussystem

Visuella badges för: `draft`, `uploaded`, `under_review`, `approved`, `rejected`, `published`. Färgkodning via design tokens.

## Komponentstruktur

```text
src/components/release-wizard/
  ReleaseWizard.tsx          (state + step orchestration)
  WizardSidebar.tsx
  StepReleaseDetails.tsx
  StepPlatforms.tsx
  StepTracks.tsx
  TrackMetadataCard.tsx
  StepRights.tsx
  StepReview.tsx
  ReleaseStatusBadge.tsx
  PlatformToggleCard.tsx
  FloatingSaveBar.tsx
src/lib/release.functions.ts (createServerFn: saveDraft, submitRelease, getDraft)
```

State hålls i en `useReducer` i `ReleaseWizard`. Validering via zod per steg.

## Databasändringar (en migration)

Utöka `albums` (en release = ett album, även singlar):

- `label TEXT`
- `language TEXT`
- `secondary_genre TEXT`
- `previously_released BOOLEAN DEFAULT false`
- `distribution_platforms TEXT[] DEFAULT '{}'` (enkla string-koder: 'spotify', 'apple_music', ...)
- `status release_status DEFAULT 'draft'` (ny enum: draft, uploaded, under_review, approved, rejected, published)
- `submitted_at TIMESTAMPTZ`, `published_at TIMESTAMPTZ`
- `internal_notes TEXT` (admin-only via RLS)
- `rights_accepted_at TIMESTAMPTZ`

Utöka `submissions` (track-nivå):

- `version TEXT` (t.ex. "Radio Edit")
- `featured_artists TEXT[]`
- `isrc TEXT`
- `explicit BOOLEAN DEFAULT false`
- `instrumental BOOLEAN DEFAULT false`
- `ai_generated BOOLEAN DEFAULT false`
- `preview_start_seconds INTEGER`
- `songwriters TEXT[]`
- `producers TEXT[]`
- `dolby_atmos_available BOOLEAN DEFAULT false`
- `atmos_audio_path TEXT`
- `duration_seconds NUMERIC`
- `loudness_lufs NUMERIC` (placeholder, nullable)

RLS uppdateras så `internal_notes` bara är läsbar av admin (skapas via en view eller column-grant). Owner/admin write-policies består.

## Admin-placeholders

Komponenter (oanvända men exporterade): `<AdminReleaseActions>` med Approve / Reject / Publish-knappar + textarea för internal_notes. Anropar `setReleaseStatus` server-fn (admin-only via `has_role(auth.uid(),'admin')`).

## Email-placeholders

Settings-sektion `src/components/release-wizard/EmailNotificationSettings.tsx` (frontend-only state nu): toggle approval/rejection-mail, val sv/en. Sparas i `profiles.preferred_language` (finns redan) + ny `profiles.notification_prefs JSONB` (lägg till i samma migration).

## Server functions

I `src/lib/release.functions.ts` (med `requireSupabaseAuth`):
- `saveReleaseDraft(input)` — upsert i albums + submissions, status `draft`.
- `submitRelease(albumId)` — sätter status `under_review`, `submitted_at = now()`, validerar att rights är accepterade.
- `getRelease(albumId)` — laddar för edit.
- `setReleaseStatus(albumId, status, internalNote?)` — admin-gated.

Upload av audio/cover sker browser-side mot befintliga buckets `audio` (private) och `artwork` (public), exakt samma mönster som dagens upload-batch.

## Design tokens & styling

Allt via `src/styles.css` semantiska tokens. Lägger till om saknas:
- `--gradient-cinematic` (mjuk graphite → primary)
- `--shadow-elegant`
- `--surface-elevated`

Mörkt läge är default; light-mode stöds via befintlig `next-themes` setup. Typography: rubriker i `font-display` (befintlig), body i `font-sans`. Inga hårdkodade färgklasser i komponenter.

## Validering & UX

- Per steg: kan inte gå framåt om obligatoriska fält saknas (visuell feedback med shake + röd ring via tokens).
- Cover art och audio: storleksgränser från befintliga konstanter (500MB audio, 20MB image).
- ISRC-validering: regex `^[A-Z]{2}[A-Z0-9]{3}\d{7}$` (mjuk varning, inte block).
- Tom state: när inga tracks uppladdade visas illustrerad drop-zone.
- Floating save: visar "Sparat kl 14:32" / "Sparar..." / "Osparade ändringar".

## Out of scope (för denna iteration)

- Faktisk distribution till streamingtjänster (bara val sparas).
- Loudness-mätning (kolumn finns, men ingen beräkning).
- Atmos-validering (filen sparas men ingen verifiering).
- Email-utskick (UI-toggles sparas, ingen sändlogik).

## Verifieringssteg

1. Migration körs och Supabase-typer uppdateras.
2. `/releases/new` renderar alla 5 steg, kan gå fram/tillbaka.
3. Draft sparas (verifiera rad i `albums` med `status='draft'`).
4. Submit flyttar status till `under_review`.
5. Mobil viewport: sidebar kollapsar till topp-progress.
6. Dark/light toggle fungerar utan färgglitchar.

