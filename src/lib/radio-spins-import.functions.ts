import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  performRadioSpinsImport,
  type RadioImportSummary,
} from "@/lib/radio-spins-import.server";

// Admin-triggered manual run.
export const runRadioSpinsImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RadioImportSummary> => {
    const { userId } = context;
    const { data: role } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!role) throw new Error("Endast admin kan köra import");
    return performRadioSpinsImport();
  });