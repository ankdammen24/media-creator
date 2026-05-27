## Goal

Replace the `/upload` placeholder with a working, protected audio upload form that POSTs `multipart/form-data` to `https://api.mediarosenqvist.com/upload/audio` using the existing Supabase-aware API client.

## Files

- **Edit** `src/routes/upload.tsx` — replace placeholder body with the full upload form. Keep the existing `ProtectedRoute` wrapper and route config.
- **Edit** `src/lib/api.ts` — add a small `apiAuthedUpload<T>()` helper that uses `XMLHttpRequest` so we can report real upload progress (the `fetch` API still has no upload progress event). It mirrors `apiAuthed`: pulls the Supabase session, attaches `Authorization: Bearer <access_token>`, POSTs FormData, parses JSON, throws on non-2xx with the backend's error message when available.

No new dependencies, no new routes, no Supabase Storage calls.

## Upload form (`/upload`)

State:
- `title`, `artist` (text inputs, both required, trimmed, max 200 chars)
- `file` (File | null)
- `status`: `"idle" | "uploading" | "success" | "error"`
- `progress`: 0–100
- `result`: `{ trackId: string } | null`
- `error`: string | null

UI sections (inside the existing card shell, same visual language as login/admin):
1. Header: upload icon + "Upload audio" + "Signed in as …"
2. Form fields:
   - Title (input)
   - Artist (input)
   - Audio file (drop zone + `<input type="file">`, `accept=".wav,.flac,.aiff,.aif,.mp3,audio/wav,audio/flac,audio/aiff,audio/mpeg"`)
   - Selected file row: name + human-readable size + Remove button
3. Client-side validation before submit:
   - All fields present
   - Extension is one of wav/flac/aiff/aif/mp3 (case-insensitive)
   - Size ≤ 500 MB (sane upper bound; backend remains source of truth)
4. Submit button: disabled while `uploading` or invalid; label flips to "Uploading…"
5. Progress bar: visible while `uploading`, driven by XHR `upload.onprogress` (`loaded / total * 100`)
6. Success panel: green-tinted card with "Uploaded" + `Track ID: <id>` (monospace, copy-to-clipboard button) + `<Link to="/catalog">View in catalog</Link>` + "Upload another" button that resets state
7. Error panel: destructive-tinted card with the message returned from the backend (or a generic network message)

## Request shape

```ts
const fd = new FormData();
fd.append("title", title.trim());
fd.append("artist", artist.trim());
fd.append("file", file, file.name);
const { trackId } = await apiAuthedUpload<{ trackId: string }>(
  "/upload/audio",
  fd,
  (pct) => setProgress(pct),
);
```

Response handling: accept `{ trackId }`, `{ id }`, or `{ track: { id } }` and normalize to a single `trackId` string so a minor backend shape change doesn't break the UI.

## `apiAuthedUpload` (XHR-based, for progress)

```ts
export async function apiAuthedUpload<T>(
  path: string,
  formData: FormData,
  onProgress?: (pct: number) => void,
): Promise<T>
```

Behavior:
- `await supabase.auth.getSession()` → throw "Not authenticated" if no token
- `new XMLHttpRequest()`, `POST ${API_BASE}${path}`
- Set `Authorization: Bearer <token>` and `Accept: application/json`. Do NOT set `Content-Type` — the browser sets the multipart boundary.
- `xhr.upload.onprogress` → `onProgress(Math.round(loaded / total * 100))` when `lengthComputable`
- On `load`: if `status` is 2xx parse JSON and resolve; else try to parse `{ error | message }` and reject with that string, fallback to `"Upload failed (<status>)"`
- On `error` / `timeout`: reject with `"Network error during upload"`
- No timeout set (large audio files); rely on backend/proxy timeouts

## Out of scope

- Drag-and-drop multi-file
- Resumable / chunked uploads
- Editing existing tracks
- Album / artwork fields
- Toast system (we render inline panels)

## Risks / assumptions

- Endpoint path is `POST /upload/audio` and field names are `title`, `artist`, `file`. If the backend uses different names we'll adjust in a small follow-up.
- Response includes a track identifier — accepting three common shapes covers us.
- No CORS issues expected since the API already accepts auth'd requests from the app origin (existing `apiAuthed` calls work).
