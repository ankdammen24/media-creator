import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const InputSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("create"),
    name: z.string().trim().min(1).max(120),
    bio: z.string().trim().max(2000).optional(),
    website: z.string().trim().max(500).optional(),
  }),
  z.object({
    mode: z.literal("approveExisting"),
    artistProfileId: z.string().uuid(),
  }),
]);

async function ensureArtistRole(userId: string) {
  const { error } = await supabaseAdmin
    .from("user_roles")
    .insert({ user_id: userId, role: "artist" });
  if (error && !/duplicate key/i.test(error.message)) {
    throw new Error(error.message);
  }
}

export const selfApproveArtistAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const now = new Date().toISOString();

    if (data.mode === "create") {
      // Duplicate name check (case-insensitive) across all artist profiles.
      const { data: existing, error: dupErr } = await supabaseAdmin
        .from("artist_profiles")
        .select("id, name")
        .ilike("name", data.name)
        .limit(1);
      if (dupErr) throw new Error(dupErr.message);
      if (existing && existing.length > 0) {
        throw new Error(`DUPLICATE_ARTIST:${existing[0].name}`);
      }

      const { data: inserted, error } = await supabaseAdmin
        .from("artist_profiles")
        .insert({
          user_id: userId,
          name: data.name,
          bio: data.bio ?? null,
          website_url: data.website ?? null,
          approval_status: "approved",
          reviewed_by: userId,
          reviewed_at: now,
        })
        .select("id, name")
        .single();
      if (error) throw new Error(error.message);

      await ensureArtistRole(userId);
      return { id: inserted.id, name: inserted.name };
    }

    // approveExisting
    const { data: profile, error: fetchErr } = await supabaseAdmin
      .from("artist_profiles")
      .select("id, name, user_id, approval_status")
      .eq("id", data.artistProfileId)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!profile) throw new Error("Artist profile not found");
    if (profile.user_id !== userId) throw new Error("Forbidden");

    if (profile.approval_status !== "approved") {
      const { error: updErr } = await supabaseAdmin
        .from("artist_profiles")
        .update({
          approval_status: "approved",
          reviewed_by: userId,
          reviewed_at: now,
          rejection_reason: null,
        })
        .eq("id", profile.id);
      if (updErr) throw new Error(updErr.message);
    }

    await ensureArtistRole(userId);
    return { id: profile.id, name: profile.name };
  });