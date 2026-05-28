import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { performAzuracastImport, type ImportSummary } from "@/lib/azuracast-import.server";

const InputSchema = z.object({
  dryRun: z.boolean().optional().default(false),
  limit: z.number().int().min(1).max(5000).optional(),
});

export const runAzuracastImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ data, context }): Promise<ImportSummary> => {
    const { userId } = context;
    const { data: role, error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (roleErr) throw new Error(`role check: ${roleErr.message}`);
    if (!role) throw new Error("Endast admin kan köra import");

    return performAzuracastImport(userId, { dryRun: data.dryRun, limit: data.limit });
  });