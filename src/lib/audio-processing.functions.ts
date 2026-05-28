import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { dispatchToWorker, logAudio } from "./audio-processing.server";

async function isAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return !!data;
}

/**
 * Enqueue a single submission for transcoding + EBU R128 normalisation.
 * Permission: owner of the submission, an artist role, or an admin.
 */
export const enqueueAudioProcessing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ submissionId: z.string().uuid(), force: z.boolean().optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: sub, error } = await supabaseAdmin
      .from("submissions")
      .select("id, user_id")
      .eq("id", data.submissionId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!sub) throw new Error("Submission saknas.");
    // Endast ägaren av låten eller en admin får köa bearbetning. Artist-rollen
    // ger INTE rätt att bearbeta andra användares låtar (cross-user isolation).
    if (sub.user_id !== userId && !(await isAdmin(userId))) {
      throw new Error("Du saknar behörighet att köa bearbetning.");
    }
    await logAudio("enqueue", `Begäran om bearbetning (force=${!!data.force}).`, {
      submissionId: data.submissionId,
      createdBy: userId,
    });
    return dispatchToWorker(data.submissionId, { force: data.force });
  });

/**
 * Admin-only: backfill up to `limit` submissions that don't yet have a
 * processed master. Returns counts so the UI can poll until done.
 */
export const enqueueAudioBackfill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        limit: z.number().int().min(1).max(500).default(50),
        force: z.boolean().optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    if (!(await isAdmin(context.userId))) {
      throw new Error("Endast admin kan starta bakåtfyllning.");
    }
    const query = supabaseAdmin
      .from("submissions")
      .select("id")
      .order("created_at", { ascending: true })
      .limit(data.limit);
    const { data: rows, error } = data.force
      ? await query
      : await query.is("audio_master_path", null).in("processing_status", ["pending", "failed"]);
    if (error) throw new Error(error.message);
    await logAudio(
      "backfill_start",
      `Backfill startad (limit=${data.limit}, force=${!!data.force}, kandidater=${rows?.length ?? 0}).`,
      { createdBy: context.userId },
    );
    let queued = 0;
    let failed = 0;
    let skipped = 0;
    for (const row of rows ?? []) {
      try {
        const result = await dispatchToWorker(row.id, { force: data.force });
        if (result.outcome === "queued") queued += 1;
        else if (result.outcome === "skipped") {
          skipped += 1;
          break; // worker unavailable — stop the batch
        } else failed += 1;
      } catch {
        failed += 1;
      }
    }
    await logAudio(
      "backfill_done",
      `Backfill klar: köade ${queued}, misslyckade ${failed}, hoppade över ${skipped}.`,
      { createdBy: context.userId, payload: { queued, failed, skipped } },
    );
    return { queued, failed, skipped, considered: rows?.length ?? 0 };
  });

/**
 * Public-readable status counts for the admin dashboard.
 */
export const getAudioProcessingStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!(await isAdmin(context.userId))) {
      throw new Error("Endast admin.");
    }
    const statuses = ["pending", "processing", "done", "failed", "skipped"] as const;
    const counts: Record<string, number> = {};
    for (const s of statuses) {
      const { count, error } = await supabaseAdmin
        .from("submissions")
        .select("id", { count: "exact", head: true })
        .eq("processing_status", s);
      if (error) throw new Error(error.message);
      counts[s] = count ?? 0;
    }
    const { count: totalCount } = await supabaseAdmin
      .from("submissions")
      .select("id", { count: "exact", head: true });
    const { count: withMaster } = await supabaseAdmin
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .not("audio_master_path", "is", null);
    return {
      counts,
      total: totalCount ?? 0,
      withMaster: withMaster ?? 0,
      workerConfigured: Boolean(process.env.AUDIO_PROCESSOR_URL),
    };
  });

/**
 * Admin-only: returns the most recent processing log entries.
 */
export const getAudioProcessingLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        limit: z.number().int().min(1).max(500).default(100),
        submissionId: z.string().uuid().optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    if (!(await isAdmin(context.userId))) {
      throw new Error("Endast admin.");
    }
    let q = supabaseAdmin
      .from("audio_processing_logs")
      .select("id, submission_id, event, level, message, payload, created_at")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.submissionId) q = q.eq("submission_id", data.submissionId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { logs: rows ?? [] };
  });