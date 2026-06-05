
# Rebrand: Media Creator → Crystal Pier Records Creator Portal

Pure copy/branding pass. No changes to API endpoints, auth logic, routes, or data flow.

## Files to update

**`src/lib/i18n.ts`**
- `appName`: `"Media Creator"` → `"Crystal Pier Records Creator Portal"`
- Add new keys: `dashboardTitle` ("Crystal Pier Dashboard"), `dashboardIntro` ("Upload your music, complete your metadata, and follow your release from processing to distribution."), `authTitle` ("Sign in to Crystal Pier Records Creator Portal"), `authSubtitle` ("Manage your uploads, tracks, releases, and distribution status."), `footer` ("Crystal Pier Records is part of Media Rosenqvist.")

**`src/components/AppShell.tsx`**
- Sidebar subtitle "Tunn skaparklient" → label-portal phrasing ("Independent label portal" or similar warm copy)
- Dashboard nav label: "Översikt" → "Crystal Pier Dashboard" (shorten to "Dashboard" in sidenav for fit; full title on page)
- Add footer line in sidebar bottom: "Crystal Pier Records is part of Media Rosenqvist."

**`src/routes/_authenticated/dashboard.tsx`**
- `PageHeader` title: "Översikt" → "Crystal Pier Dashboard"
- Description: replace with the intro line above
- Keep metrics + recent tracks structure

**`src/routes/auth.tsx`**
- Heading: "Media Creator" → "Crystal Pier Records Creator Portal"
- Subtext (both modes): use authSubtitle copy; sign-in still says "Sign in to Crystal Pier Records Creator Portal"
- Add small footer under card: "Crystal Pier Records is part of Media Rosenqvist."

**`index.html`**
- `<title>`: "Media Creator" → "Crystal Pier Records Creator Portal"
- `<meta name="description">` → "Upload your music, complete your metadata, and follow your release from processing to distribution. Crystal Pier Records creator portal."

**`README.md`** (light touch)
- Rename headline + first paragraph to reflect Crystal Pier Records Creator Portal; keep all technical sections intact.

## Visual direction (light pass)

Keep current dark theme + shadcn tokens; no palette overhaul in this pass. Only the copy + a subtle wordmark tweak in the sidebar (two-line: "Crystal Pier Records" / "Creator Portal") to make it feel like a label rather than a generic admin. If you want a fuller visual rebrand (palette tuned to coastal/crystal, custom typography, logo mark), say so and I'll do that as a follow-up with design directions.

## Out of scope

- API base URL, auth flow, route structure
- Adding catalog/listener UI
- Supabase schema changes
- New dependencies
