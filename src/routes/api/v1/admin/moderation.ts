import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { authenticateApiKey, requireScope } from "@/lib/api-auth.server";
import { V1_CORS, errorResponse, jsonResponse, optionsResponse } from "@/lib/api-cors";

const patchSchema = z.object({
  submission_id: z.string().uuid(),
  action: z.enum(["approve", "reject"]),
  rejection_reason: z.string().max(2000).nullable().optional(),
});

export const Route = createFileRoute("/api/v1/admin/moderation")({
  server: {
    handlers: {
      OPTIONS: async () => optionsResponse(V1_CORS),
      GET: async ({ request }) => {
        const auth = await authenticateApiKey(request);
        if ("error" in auth) return auth.error;
        const scopeErr = requireScope(auth, "admin:moderate");
        if (scopeErr) return scopeErr;
        const { data, error } = await supabaseAdmin
          .from("submissions")
          .select("id, title, media_type, status, created_at, artist_profile_id, user_id")
          .eq("status", "pending_review")
          .order("created_at", { ascending: true })
          .limit(200);
        if (error) return errorResponse(error.message, 500, V1_CORS);
        return jsonResponse({ data: data ?? [] }, { cors: V1_CORS });
      },
      PATCH: async ({ request }) => {
        const auth = await authenticateApiKey(request);
        if ("error" in auth) return auth.error;
        const scopeErr = requireScope(auth, "admin:moderate");
        if (scopeErr) return scopeErr;
        let body: unknown;
        try { body = await request.json(); } catch { return errorResponse("Invalid JSON", 400, V1_CORS); }
        const parsed = patchSchema.safeParse(body);
        if (!parsed.success) return errorResponse(parsed.error.message, 400, V1_CORS);
        const update =
          parsed.data.action === "approve"
            ? { status: "approved" as const, approved_at: new Date().toISOString(), rejection_reason: null }
            : { status: "rejected" as const, rejection_reason: parsed.data.rejection_reason ?? null };
        const { data, error } = await supabaseAdmin
          .from("submissions")
          .update(update)
          .eq("id", parsed.data.submission_id)
          .select("id, status, approved_at, rejection_reason")
          .single();
        if (error) return errorResponse(error.message, 400, V1_CORS);
        return jsonResponse({ data }, { cors: V1_CORS });
      },
    },
  },
});
