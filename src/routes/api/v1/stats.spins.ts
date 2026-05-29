import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { authenticateApiKey, requireScope } from "@/lib/api-auth.server";
import { V1_CORS, errorResponse, jsonResponse, optionsResponse } from "@/lib/api-cors";

export const Route = createFileRoute("/api/v1/stats/spins")({
  server: {
    handlers: {
      OPTIONS: async () => optionsResponse(V1_CORS),
      GET: async ({ request }) => {
        const auth = await authenticateApiKey(request);
        if ("error" in auth) return auth.error;
        const scopeErr = requireScope(auth, "read:stats");
        if (scopeErr) return scopeErr;

        const url = new URL(request.url);
        const submissionId = url.searchParams.get("submission");
        const since = url.searchParams.get("since"); // ISO date
        const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "200", 10) || 200, 1000);

        let query = supabaseAdmin
          .from("playback_events")
          .select("id, submission_id, event_type, occurred_at, source")
          .order("occurred_at", { ascending: false })
          .limit(limit);
        if (submissionId) query = query.eq("submission_id", submissionId);
        if (since) query = query.gte("occurred_at", since);

        const { data, error } = await query;
        if (error) return errorResponse(error.message, 500, V1_CORS);

        // For user keys, filter by submissions they own
        if (auth.type === "user" && auth.ownerUserId) {
          const ids = Array.from(new Set((data ?? []).map((r) => r.submission_id)));
          if (ids.length === 0) {
            return jsonResponse({ data: [] }, { cors: V1_CORS });
          }
          const { data: owned } = await supabaseAdmin
            .from("submissions")
            .select("id")
            .in("id", ids)
            .eq("user_id", auth.ownerUserId);
          const allowed = new Set((owned ?? []).map((r) => r.id));
          return jsonResponse(
            { data: (data ?? []).filter((r) => allowed.has(r.submission_id)) },
            { cors: V1_CORS },
          );
        }
        return jsonResponse({ data: data ?? [] }, { cors: V1_CORS });
      },
    },
  },
});
