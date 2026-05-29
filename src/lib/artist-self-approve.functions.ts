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

export const selfApproveArtistAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const rpcArgs =
      data.mode === "create"
        ? {
            _user_id: userId,
            _mode: "create",
            _name: data.name,
            _bio: data.bio ?? null,
            _website: data.website ?? null,
            _artist_profile_id: null,
          }
        : {
            _user_id: userId,
            _mode: "approveExisting",
            _name: null,
            _bio: null,
            _website: null,
            _artist_profile_id: data.artistProfileId,
          };

    const { data: rows, error } = await supabaseAdmin.rpc(
      "self_approve_artist_account",
      rpcArgs as never,
    );
    if (error) {
      const msg = error.message ?? "Failed to activate artist account";
      if (msg.startsWith("duplicate_artist:")) {
        const name = msg.slice("duplicate_artist:".length);
        throw new Error(`DUPLICATE_ARTIST:${name}`);
      }
      throw new Error(msg);
    }
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row) throw new Error("Activation failed");
    return { id: row.id as string, name: row.name as string };
  });