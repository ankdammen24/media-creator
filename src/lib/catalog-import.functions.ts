import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { parseWorkbook, matchRows } from "@/lib/catalog-import.server";

async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(`role check: ${error.message}`);
  if (!data) throw new Error("Endast admin kan köra import");
}

const ParseInput = z.object({
  filename: z.string().min(1).max(255),
  fileBase64: z.string().min(1),
});

export const parseCatalogImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => ParseInput.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    await assertAdmin(userId);

    const bytes = Uint8Array.from(Buffer.from(data.fileBase64, "base64"));
    const parsed = parseWorkbook(bytes);
    const matched = await matchRows(parsed);

    const summary = {
      total: matched.length,
      matched: matched.filter((r) => r.match_status === "matched").length,
      partial: matched.filter((r) => r.match_status === "partial").length,
      unmatched: matched.filter((r) => r.match_status === "unmatched").length,
      conflict: matched.filter((r) => r.match_status === "conflict").length,
      duplicate: matched.filter((r) => r.match_status === "duplicate").length,
      skipped: matched.filter((r) => r.match_status === "skipped").length,
    };

    const { data: run, error: runErr } = await supabaseAdmin
      .from("import_runs")
      .insert({
        source: "xlsx",
        filename: data.filename,
        created_by: userId,
        status: "preview",
        summary,
      })
      .select("id")
      .single();
    if (runErr || !run) throw new Error(`Kunde inte skapa import_run: ${runErr?.message}`);

    const rowsForInsert = matched.map((r) => ({
      run_id: run.id,
      sheet_name: r.sheet_name,
      row_index: r.row_index,
      artist_name_raw: r.artist_name_raw,
      album_title_raw: r.album_title_raw,
      track_title_raw: r.track_title_raw,
      upc_raw: r.upc_raw,
      isrc_raw: r.isrc_raw,
      match_status: r.match_status,
      matched_artist_id: r.matched_artist_id,
      matched_album_id: r.matched_album_id,
      matched_submission_id: r.matched_submission_id,
      proposed_changes: r.proposed_changes,
      notes: r.notes,
    }));

    // Insert in chunks to stay safe
    const chunk = 200;
    for (let i = 0; i < rowsForInsert.length; i += chunk) {
      const slice = rowsForInsert.slice(i, i + chunk);
      const { error } = await supabaseAdmin.from("import_rows").insert(slice);
      if (error) throw new Error(`insert rows: ${error.message}`);
    }

    const { data: stored } = await supabaseAdmin
      .from("import_rows")
      .select("*")
      .eq("run_id", run.id)
      .order("sheet_name")
      .order("row_index");

    return { runId: run.id, summary, rows: stored ?? [] };
  });

const ApplyInput = z.object({
  runId: z.string().uuid(),
  decisions: z
    .array(
      z.object({
        rowId: z.string().uuid(),
        action: z.enum(["apply", "overwrite", "skip"]),
      }),
    )
    .max(10000),
});

export const applyCatalogImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => ApplyInput.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    await assertAdmin(userId);

    const decisionMap = new Map(data.decisions.map((d) => [d.rowId, d.action]));

    const { data: rows, error: rowsErr } = await supabaseAdmin
      .from("import_rows")
      .select("*")
      .eq("run_id", data.runId);
    if (rowsErr || !rows) throw new Error(`load rows: ${rowsErr?.message}`);

    let applied = 0;
    let skipped = 0;
    let failed = 0;
    const errors: Array<{ rowId: string; message: string }> = [];

    for (const row of rows) {
      const action = decisionMap.get(row.id) ?? "skip";
      if (action === "skip") {
        skipped++;
        continue;
      }
      const proposals = (row.proposed_changes ?? {}) as Record<
        string,
        { table: string; field: string; before: string | null; after: string }
      >;
      if (!proposals || Object.keys(proposals).length === 0) {
        skipped++;
        continue;
      }

      const appliedChanges: Record<string, unknown> = {};
      try {
        // Group by table
        const albumUpdates: Record<string, unknown> = {};
        const subUpdates: Record<string, unknown> = {};
        for (const [, p] of Object.entries(proposals)) {
          if (p.before !== null && action !== "overwrite") continue; // skip overwrite unless allowed
          if (p.table === "albums") albumUpdates[p.field] = p.after;
          else if (p.table === "submissions") subUpdates[p.field] = p.after;
          appliedChanges[p.field] = { before: p.before, after: p.after };
        }

        if (Object.keys(albumUpdates).length > 0 && row.matched_album_id) {
          albumUpdates.external_catalog_source = "xlsx";
          albumUpdates.metadata_imported_at = new Date().toISOString();
          const { error } = await supabaseAdmin
            .from("albums")
            .update(albumUpdates)
            .eq("id", row.matched_album_id);
          if (error) throw new Error(error.message);
        }
        if (Object.keys(subUpdates).length > 0 && row.matched_submission_id) {
          subUpdates.external_catalog_source = "xlsx";
          subUpdates.metadata_imported_at = new Date().toISOString();
          const { error } = await supabaseAdmin
            .from("submissions")
            .update(subUpdates)
            .eq("id", row.matched_submission_id);
          if (error) throw new Error(error.message);
        }

        await supabaseAdmin
          .from("import_rows")
          .update({
            match_status: Object.keys(appliedChanges).length > 0 ? "matched" : "skipped",
            applied_changes: appliedChanges,
          })
          .eq("id", row.id);

        if (Object.keys(appliedChanges).length > 0) applied++;
        else skipped++;
      } catch (e) {
        failed++;
        const msg = e instanceof Error ? e.message : String(e);
        errors.push({ rowId: row.id, message: msg });
        await supabaseAdmin
          .from("import_rows")
          .update({ notes: `Apply error: ${msg}` })
          .eq("id", row.id);
      }
    }

    await supabaseAdmin
      .from("import_runs")
      .update({
        status: "applied",
        completed_at: new Date().toISOString(),
        summary: { applied, skipped, failed, errors },
      })
      .eq("id", data.runId);

    return { applied, skipped, failed, errors };
  });

export const listImportRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    await assertAdmin(userId);
    const { data, error } = await supabaseAdmin
      .from("import_runs")
      .select("id, filename, status, summary, created_at, completed_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });