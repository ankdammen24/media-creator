import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { PUBLIC_CORS, errorResponse, jsonResponse, optionsResponse } from "@/lib/api-cors";
import { PUBLIC_ALBUM_COLUMNS, parsePagination, projectAlbum } from "@/lib/api-projections";

export const Route = createFileRoute("/api/public/albums")({
  server: {
    handlers: {
      OPTIONS: async () => optionsResponse(PUBLIC_CORS),
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const { limit, offset } = parsePagination(url);
          const artistId = url.searchParams.get("artist");
          const type = url.searchParams.get("type");
          const q = url.searchParams.get("q");
          let query = supabaseAdmin
            .from("albums")
            .select(PUBLIC_ALBUM_COLUMNS, { count: "exact" })
            .eq("status", "published")
            .order("release_date", { ascending: false, nullsFirst: false })
            .range(offset, offset + limit - 1);
          if (artistId) query = query.eq("artist_profile_id", artistId);
          if (type) query = query.eq("album_type", type as "album" | "ep" | "single" | "compilation" | "podcast_show");
          if (q && q.trim().length > 0) query = query.ilike("title", `%${q.trim()}%`);
          const { data, error, count } = await query;
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
