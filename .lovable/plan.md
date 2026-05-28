## Problem

The error "Could not embed because more than one relationship was found for 'submissions' and 'artist_profiles'" is triggered by the single-artwork regeneration query. The `submissions` table is linked to `artist_profiles` through two paths:

- the direct `submissions.artist_profile_id` foreign key
- the indirect path via the `submission_artists` junction table

When an embed is written as plain `artist_profiles(name)`, PostgREST can't choose which relationship to use and rejects the request.

## Fix

In `src/lib/artwork.functions.ts` (the submissions query around line 379), change the embed from:

```text
artist_profiles(name)
```

to the explicit foreign-key hint already used everywhere else in the app:

```text
artist_profiles!submissions_artist_profile_id_fkey(name)
```

This is a one-line change scoped to the submissions query only. The other plain `artist_profiles(name)` embeds in this file target the `albums` table, which has a single relationship to `artist_profiles`, so they are unaffected and stay as-is.

## Verification

- Re-run the "Regenerera singel-omslag" admin action and confirm it no longer errors.
- Confirm the other submissions queries (index, catalog, admin, player, search) still work since they already use the hint.
