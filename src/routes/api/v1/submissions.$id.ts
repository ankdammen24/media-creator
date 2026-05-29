import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { authenticateApiKey, requireScope } from "@/lib/api-auth.server";
import { V1_CORS, errorResponse, jsonResponse, optionsResponse } from "@/lib/api-cors";

const patchSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  description: z.string().max(5000).nullable().optional(),
  isrc: z.string().max(32).nullable().optional(),
  explicit: z.boolean().optional(),
});

export const Route = createFileRoute("/api/v1/submissions/$id")({
  server: {
    handlers: {
      OPTIONS: async () => optionsResponse(V1_CORS),
      GET: async ({ request, params }) => {
        const auth = await authenticateApiKey(request);
        if ("error" in auth) return auth.error;
        const scopeErr = requireScope(auth, "read:catalog");
        if (scopeErr) return scopeErr;
        let query = supabaseAdmin
          .from("submissions")
          .select("*")
          .eq("id", params.id);
        if (auth.type === "user" && auth.ownerUserId) {
          query = query.eq("user_id", auth.ownerUserId);
        }
        const { data, error } = await query.maybeSingle();
        if (error) return errorResponse(error.message, 500, V1_CORS);
        if (!data) return errorResponse("Not found", 404, V1_CORS);
        return jsonResponse({ data }, { cors: V1_CORS });
      },
      PATCH: async ({ request, params }) => {
        const auth = await authenticateApiKey(request);
        if ("error" in auth) return auth.error;
        const scopeErr = requireScope(auth, "write:submissions");
        if (scopeErr) return scopeErr;
        let body: unknown;
        try { body = await request.json(); } catch { return errorResponse("Invalid JSON", 400, V1_CORS); }
        const parsed = patchSchema.safeParse(body);
        if (!parsed.success) return errorResponse(parsed.error.message, 400, V1_CORS);

        // Verify ownership for user keys
        if (auth.type === "user") {
          const { data: row } = await supabaseAdmin
            .from("submissions")
            .select("user_id, status")
            .eq("id", params.id)
            .maybeSingle();
          if (!row || row.user_id !== auth.ownerUserId) {
            return errorResponse("Forbidden", 403, V1_CORS);
          }
          if (row.status !== "pending_review" && row.status !== "rejected") {
            return errorResponse("Can only edit pending or rejected submissions", 409, V1_CORS);
          }
        }
        const { data, error } = await supabaseAdmin
          .from("submissions")
          .update(parsed.data)
          .eq("id", params.id)
          .select("id, title, status, updated_at")
          .single();
        if (error) return errorResponse(error.message, 400, V1_CORS);
        return jsonResponse({ data }, { cors: V1_CORS });
      },
    },
  },
});
