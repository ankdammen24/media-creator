import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin role required");
}

export const listUsersWithRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, supabase } = context;
    await assertAdmin(supabase, userId);

    const { data: profiles, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("user_id, display_name, created_at")
      .order("created_at", { ascending: false });
    if (pErr) throw new Error(pErr.message);

    const ids = (profiles ?? []).map((p) => p.user_id);
    const [{ data: roles }, { data: artistRows }] = await Promise.all([
      ids.length
        ? supabaseAdmin.from("user_roles").select("user_id, role").in("user_id", ids)
        : Promise.resolve({ data: [] as { user_id: string; role: string }[] }),
      ids.length
        ? supabaseAdmin
            .from("artist_profiles")
            .select("id, name, user_id")
            .in("user_id", ids)
        : Promise.resolve({ data: [] as { id: string; name: string; user_id: string }[] }),
    ]);

    const rolesByUser = new Map<string, string[]>();
    for (const r of roles ?? []) {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push(r.role);
      rolesByUser.set(r.user_id, arr);
    }
    const artistsByUser = new Map<string, { id: string; name: string }[]>();
    for (const a of artistRows ?? []) {
      const arr = artistsByUser.get(a.user_id) ?? [];
      arr.push({ id: a.id, name: a.name });
      artistsByUser.set(a.user_id, arr);
    }

    return (profiles ?? []).map((p) => ({
      user_id: p.user_id,
      display_name: p.display_name,
      created_at: p.created_at,
      roles: rolesByUser.get(p.user_id) ?? [],
      artist_profiles: artistsByUser.get(p.user_id) ?? [],
    }));
  });

const SetArtistRoleSchema = z.object({
  targetUserId: z.string().uuid(),
  grant: z.boolean(),
});

export const setUserArtistRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => SetArtistRoleSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;
    await assertAdmin(supabase, userId);

    if (data.grant) {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: data.targetUserId, role: "artist" });
      // Ignore duplicate unique-violation
      if (error && !/duplicate key/i.test(error.message)) {
        throw new Error(error.message);
      }
    } else {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.targetUserId)
        .eq("role", "artist");
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

const CreateArtistSchema = z.object({
  targetUserId: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  bio: z.string().trim().max(2000).optional(),
  alsoGrantArtistRole: z.boolean().optional(),
});

export const createArtistProfileForUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => CreateArtistSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;
    await assertAdmin(supabase, userId);

    const { data: inserted, error } = await supabaseAdmin
      .from("artist_profiles")
      .insert({ user_id: data.targetUserId, name: data.name, bio: data.bio ?? null })
      .select("id, name")
      .single();
    if (error) throw new Error(error.message);

    if (data.alsoGrantArtistRole) {
      const { error: rErr } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: data.targetUserId, role: "artist" });
      if (rErr && !/duplicate key/i.test(rErr.message)) {
        throw new Error(rErr.message);
      }
    }
    return { id: inserted.id, name: inserted.name };
  });