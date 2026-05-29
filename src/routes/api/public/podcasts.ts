import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { PUBLIC_CORS, errorResponse, jsonResponse, optionsResponse } from "@/lib/api-cors";
import { PUBLIC_ALBUM_COLUMNS, parsePagination, projectAlbum } from "@/lib/api-projections";

export const Route = createFileRoute("/api/public/podcasts")({
  server: {
    handlers: {
      OPTIONS: async () => optionsResponse(PUBLIC_CORS),
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const { limit, offset } = parsePagination(url);
          const { data, error, count } = await supabaseAdmin
            .from("albums")
            .select(PUBLIC_ALBUM_COLUMNS, { count: "exact" })
            .eq("status", "published")
            .eq("album_type", "podcast")
            .order("release_date", { ascending: false, nullsFirst: false })
            .range(offset, offset + limit - 1);
          if (error) return errorResponse(error.message, 500);
          return jsonResponse({
            data: (data ?? []).map((r) => projectAlbum(r as Record<string, unknown>)),
            pagination: { limit, offset, total: count ?? null },
          });
        } catch (e) {
          return errorResponse(e instanceof Error ? e.message : "Server error", 500);
        }
      },
    },
  },
});
