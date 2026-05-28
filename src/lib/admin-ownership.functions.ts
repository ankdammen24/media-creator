import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const InputSchema = z.object({
  artistId: z.string().uuid(),
  newUserId: z.string().uuid(),
  reason: z.string().trim().max(500).optional(),
  preview: z.boolean().optional(),
});

export const reassignArtistOwner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;

    // Verify caller is admin (RLS-protected via authed client)
    const { data: roleRow, error: roleErr } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (roleErr) throw new Error(roleErr.message);
    if (!roleRow) throw new Error("Forbidden: admin role required");

    // Read current owner
    const { data: artist, error: artistErr } = await supabaseAdmin
      .from("artist_profiles")
      .select("id, user_id, name")
      .eq("id", data.artistId)
      .maybeSingle();
    if (artistErr) throw new Error(artistErr.message);
    if (!artist) throw new Error("Artist not found");

    const fromUserId = artist.user_id;
    const toUserId = data.newUserId;

    // Count related rows
    const [albumsCount, submissionsCount, imagesCount] = await Promise.all([
      supabaseAdmin
        .from("albums")
        .select("id", { count: "exact", head: true })
        .eq("artist_profile_id", data.artistId),
      supabaseAdmin
        .from("submissions")
        .select("id", { count: "exact", head: true })
        .eq("artist_profile_id", data.artistId),
      supabaseAdmin
        .from("artist_images")
        .select("id", { count: "exact", head: true })
        .eq("artist_profile_id", data.artistId),
    ]);

    const counts = {
      albums: albumsCount.count ?? 0,
      submissions: submissionsCount.count ?? 0,
      images: imagesCount.count ?? 0,
    };

    if (data.preview) {
      return {
        preview: true as const,
        from: fromUserId,
        to: toUserId,
        artistName: artist.name,
        counts,
      };
    }

    if (fromUserId === toUserId) {
      return { preview: false as const, from: fromUserId, to: toUserId, counts, noop: true as const };
    }

    // Verify new owner exists in profiles
    const { data: newOwner, error: newOwnerErr } = await supabaseAdmin
      .from("profiles")
      .select("user_id")
      .eq("user_id", toUserId)
      .maybeSingle();
    if (newOwnerErr) throw new Error(newOwnerErr.message);
    if (!newOwner) throw new Error("New owner not found");

    // Sequential updates. Stop on first error.
    const a = await supabaseAdmin
      .from("artist_profiles")
      .update({ user_id: toUserId })
      .eq("id", data.artistId);
    if (a.error) throw new Error(`artist_profiles: ${a.error.message}`);

    const b = await supabaseAdmin
      .from("albums")
      .update({ user_id: toUserId })
      .eq("artist_profile_id", data.artistId);
    if (b.error) throw new Error(`albums: ${b.error.message}`);

    const c = await supabaseAdmin
      .from("submissions")
      .update({ user_id: toUserId })
      .eq("artist_profile_id", data.artistId);
    if (c.error) throw new Error(`submissions: ${c.error.message}`);

    const d = await supabaseAdmin
      .from("artist_images")
      .update({ user_id: toUserId })
      .eq("artist_profile_id", data.artistId);
    if (d.error) throw new Error(`artist_images: ${d.error.message}`);

    const log = await supabaseAdmin.from("artist_ownership_log").insert({
      artist_profile_id: data.artistId,
      from_user_id: fromUserId,
      to_user_id: toUserId,
      changed_by: userId,
      affected_albums: counts.albums,
      affected_submissions: counts.submissions,
      affected_images: counts.images,
      reason: data.reason ?? null,
    });
    if (log.error) throw new Error(`ownership_log: ${log.error.message}`);

    return {
      preview: false as const,
      from: fromUserId,
      to: toUserId,
      counts,
      noop: false as const,
    };
  });

export const listOwnershipLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, supabase } = context;
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) throw new Error("Forbidden: admin role required");

    const { data: rows, error } = await supabaseAdmin
      .from("artist_ownership_log")
      .select(
        "id, artist_profile_id, from_user_id, to_user_id, changed_by, affected_albums, affected_submissions, affected_images, reason, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);

    const ids = new Set<string>();
    const artistIds = new Set<string>();
    for (const r of rows ?? []) {
      ids.add(r.from_user_id);
      ids.add(r.to_user_id);
      ids.add(r.changed_by);
      artistIds.add(r.artist_profile_id);
    }

    const [profiles, artists] = await Promise.all([
      ids.size
        ? supabaseAdmin
            .from("profiles")
            .select("user_id, display_name")
            .in("user_id", Array.from(ids))
        : Promise.resolve({ data: [] as { user_id: string; display_name: string | null }[] }),
      artistIds.size
        ? supabaseAdmin
            .from("artist_profiles")
            .select("id, name")
            .in("id", Array.from(artistIds))
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    ]);

    const nameByUser = new Map<string, string>();
    for (const p of profiles.data ?? []) {
      nameByUser.set(p.user_id, p.display_name ?? p.user_id);
    }
    const nameByArtist = new Map<string, string>();
    for (const a of artists.data ?? []) {
      nameByArtist.set(a.id, a.name);
    }

    return (rows ?? []).map((r) => ({
      ...r,
      artist_name: nameByArtist.get(r.artist_profile_id) ?? r.artist_profile_id,
      from_name: nameByUser.get(r.from_user_id) ?? r.from_user_id,
      to_name: nameByUser.get(r.to_user_id) ?? r.to_user_id,
      changed_by_name: nameByUser.get(r.changed_by) ?? r.changed_by,
    }));
  });