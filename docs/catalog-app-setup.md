# Catalog App — connect to the shared Creator backend

The Catalog app is a **separate** Lovable project that points at the **same** Supabase backend as Creator. No data is duplicated.

## 1. Environment variables (Catalog project)

Add these to the Catalog project's `.env`:

```
VITE_SUPABASE_URL=https://bgdhmwncgbahvykuvxzr.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_QDHK8U5E1YSkQn2YrZ8QfQ_w9a79sMP
```

> The `ANON_KEY` above is the publishable key — safe to ship in client code.

## 2. Shared Supabase client (drop into `src/lib/supabase.ts` of the Catalog app)

```ts
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: "catalog-auth",   // <— different storageKey from Creator
  },
});
```

The distinct `storageKey` prevents the two apps from clobbering each other's
sessions if a user has both open in the same browser. The underlying
`auth.users` table is shared, so the same email/password works in both.

## 3. Reading published tracks

Catalog should read **only** `published_tracks_view`. Never query `submissions`
directly from Catalog — the view already filters to approved tracks on
published albums by approved artists, and hides admin-only columns.

```ts
export type CatalogTrack = {
  track_id: string;
  title: string;
  isrc: string | null;
  duration_seconds: number | null;
  track_number: number | null;
  explicit: boolean;
  featured_artists: string[];
  preview_path: string | null;       // path in audio-previews bucket
  track_artwork_path: string | null; // path in cover-art bucket (fallback)
  media_type: "music" | "podcast";
  approved_at: string | null;
  created_at: string;
  artist_id: string;
  artist_name: string;
  artist_avatar_path: string | null;
  album_id: string | null;
  album_title: string | null;
  album_artwork_path: string | null; // path in cover-art bucket
  release_date: string | null;
  genre: string | null;
  upc: string | null;
  label: string | null;
};

export async function listPublishedTracks() {
  const { data, error } = await supabase
    .from("published_tracks_view")
    .select("*")
    .order("approved_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as CatalogTrack[];
}

export async function getPublishedTrack(trackId: string) {
  const { data, error } = await supabase
    .from("published_tracks_view")
    .select("*")
    .eq("track_id", trackId)
    .maybeSingle();
  if (error) throw error;
  return data as CatalogTrack | null;
}
```

## 4. Streaming previews and showing cover art

Buckets are currently **private** (your workspace blocks public buckets). The
RLS policies on `storage.objects` allow anonymous reads of `audio-previews`
and `cover-art`, so the Catalog app fetches them via **signed URLs**:

```ts
export async function previewUrl(path: string, expiresSec = 3600) {
  const { data, error } = await supabase
    .storage
    .from("audio-previews")
    .createSignedUrl(path, expiresSec);
  if (error) throw error;
  return data.signedUrl;
}

export async function coverUrl(path: string, expiresSec = 3600) {
  const { data, error } = await supabase
    .storage
    .from("cover-art")
    .createSignedUrl(path, expiresSec);
  if (error) throw error;
  return data.signedUrl;
}
```

> To switch to plain public URLs (no signing), ask a workspace admin to enable
> public buckets in **Workspace Settings → Privacy & Security**, then re-run
> the bucket creation as public — code can drop the `createSignedUrl` calls.

## 5. Shared storage layout (Creator writes, Catalog reads)

| Bucket            | Visibility | Owner path convention | Purpose                                |
|-------------------|------------|------------------------|----------------------------------------|
| `audio-originals` | private    | `<user_id>/<file>`     | Lossless masters — Creator only        |
| `audio-previews`  | private + anon-read RLS | `<user_id>/<file>` | Transcoded previews streamed by Catalog |
| `cover-art`       | private + anon-read RLS | `<user_id>/<file>` | Album / track artwork                  |
| `documents`       | private    | `<user_id>/<file>`     | Contracts, splits, internal docs       |

Creator MUST write files under the user's own UID folder; the RLS policies
reject inserts that don't match `auth.uid()`.

## 6. New shared tables

- **`media_files`** — one row per uploaded file (bucket + path + kind + size +
  optional links to `submissions`/`albums`/`artist_profiles`).
- **`approvals`** — append-only audit log of every review decision.

Both have RLS: owners read their own, admins/super_admins read all.

## 7. What Catalog must NOT do

- Never query `submissions`, `albums`, `artist_profiles`, `media_files`,
  `approvals`, or `user_roles` directly. Use the view.
- Never use the service role key. Catalog is a public app.
- Never call mutating endpoints. RLS will reject them anyway.
