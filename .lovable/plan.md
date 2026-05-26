## Soundloom Core — Plan

A clean, dark-mode music catalog frontend for Media Rosenqvist, consuming `https://api.mediarosenqvist.com`. Read-only catalog + preview player + Radio Uppsala now-playing. No auth wiring (UI only).

### API verification

Already probed:
- `/health` → `{ok:true, service:"media-catalog"}`
- `/tracks`, `/artists`, `/releases` → `{items: []}` (currently empty — empty states required)
- `/integrations/azuracast/nowplaying` → returns `{source, station, nowPlaying:{title,artist,album,art,duration,playedAt}, tracks:[...]}`

### Routes (TanStack Start, file-based)

```
src/routes/
  __root.tsx              shell + nav + footer + QueryClientProvider
  index.tsx               Home: hero, Now Playing widget, featured tracks
  catalog.tsx             Music catalog: tracks/artists/releases tabs, search/filter
  tracks.$trackId.tsx     Track detail: metadata, artwork, preview player, source badge
  login.tsx               Login UI scaffolding (disabled, shows "coming soon")
```

Each route declares its own `head()` with unique title/description/og tags.

### Data layer

- `src/lib/api.ts` — tiny fetch wrapper using `import.meta.env.VITE_API_BASE_URL` (fallback to `https://api.mediarosenqvist.com`). Throws on non-2xx.
- `src/lib/queries.ts` — `queryOptions` factories for tracks list, track by id, artists, releases, now-playing.
- TanStack Query already in template. Use `ensureQueryData` in loaders + `useSuspenseQuery` in components per project conventions.
- Now Playing: `useQuery` with `refetchInterval: 15000` for live updates.
- `.env` file created with `VITE_API_BASE_URL=https://api.mediarosenqvist.com`.

### Components

- `components/NowPlaying.tsx` — Radio Uppsala card with art, title, artist, AzuraCast badge, live pulse indicator.
- `components/TrackCard.tsx` — artwork, title, artist, source badge, play button.
- `components/SourceBadge.tsx` — variants: `media-catalog` (primary) / `azuracast` (accent).
- `components/PreviewPlayer.tsx` — HTML5 `<audio>` with `src={API_BASE}/playback/${trackId}/preview`. Browser follows the 302 to R2 automatically. Play/pause, progress bar, error state if 404/403.
- `components/StateViews.tsx` — `LoadingSkeleton`, `ErrorState`, `EmptyState` for the catalog (which is currently empty).
- `components/SiteHeader.tsx` / `SiteFooter.tsx` — nav: Home, Catalog, Login.

### Design system

- Dark-first via `.dark` class on `<html>` in `__root.tsx` shell (no theme toggle in v1).
- Update `src/styles.css` `.dark` tokens to a music-platform palette: near-black background, elevated card surface, soft white foreground, single saturated accent for primary actions and active states. Tokens only — no hardcoded hex in components.
- Tailwind utility classes via existing tokens (`bg-card`, `text-foreground`, `bg-primary`, etc.).
- Responsive: mobile-first; catalog grid `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`.

### Auth (UI only)

- `/login` renders email/password form with submit disabled and a note: "Authentication will be enabled once the backend `/auth/login` endpoint is live."
- No token storage, no fetch to `/auth/*`, no protected routes.
- Header shows a "Sign in" link.

### Out of scope (explicitly not built)

Upload, processing, admin editing, third-party OAuth, Supabase, Clerk, Lovable auth, mock auth.

### Technical notes

- All API calls are public GETs — no auth headers.
- Preview audio element uses `crossOrigin="anonymous"` only if needed; default works since R2 URL is the actual media source after redirect.
- Empty `/tracks` today → catalog page must show a polished empty state rather than a blank grid.
- Error boundaries on every loader route per template rules.
