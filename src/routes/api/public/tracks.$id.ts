import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { PUBLIC_CORS, errorResponse, jsonResponse, optionsResponse } from "@/lib/api-cors";
import { PUBLIC_TRACK_COLUMNS, projectTrack } from "@/lib/api-projections";

export const Route = createFileRoute("/api/public/tracks/$id")({
  server: {
    handlers: {
      OPTIONS: async () => optionsResponse(PUBLIC_CORS),
      GET: async ({ params }) => {
        const { data, error } = await supabaseAdmin
          .from("submissions")
          .select(PUBLIC_TRACK_COLUMNS)
          .eq("id", params.id)
          .eq("status", "approved")
          .maybeSingle();
        if (error) return errorResponse(error.message, 500);
        if (!data) return errorResponse("Not found", 404);
        return jsonResponse({ data: projectTrack(data as Record<string, unknown>) });
      },
    },
  },
});
