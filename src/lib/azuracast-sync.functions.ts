import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  pushSubmissionToAzuracast,
  syncCatalogToAzuracast,
} from "./azuracast-sync.server";

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

export const runAzuracastSync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ dryRun: z.boolean().optional() }).parse(input ?? {}))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    return syncCatalogToAzuracast({ dryRun: data.dryRun });
  });

export const pushOneToAzuracast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ submissionId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    return pushSubmissionToAzuracast(data.submissionId);
  });