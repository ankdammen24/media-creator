import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { PUBLIC_CORS, errorResponse, jsonResponse, optionsResponse } from "@/lib/api-cors";
import { PUBLIC_TRACK_COLUMNS, parsePagination, projectTrack } from "@/lib/api-projections";

export const Route = createFileRoute("/api/public/tracks")({
  server: {
    handlers: {
      OPTIONS: async () => optionsResponse(PUBLIC_CORS),
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const { limit, offset } = parsePagination(url);
          const artistId = url.searchParams.get("artist");
          const albumId = url.searchParams.get("album");
          const mediaType = url.searchParams.get("media_type");
          const q = url.searchParams.get("q");

          let query = supabaseAdmin
            .from("submissions")
            .select(PUBLIC_TRACK_COLUMNS, { count: "exact" })
            .eq("status", "approved")
            .order("approved_at", { ascending: false, nullsFirst: false })
            .range(offset, offset + limit - 1);

          if (artistId) query = query.eq("artist_profile_id", artistId);
          if (albumId) query = query.eq("album_id", albumId);
          if (mediaType === "music" || mediaType === "podcast")
            query = query.eq("media_type", mediaType);
          if (q && q.trim().length > 0) query = query.ilike("title", `%${q.trim()}%`);

          const { data, error, count } = await query;
          if (error) return errorResponse(error.message, 500);
          return jsonResponse({
            data: (data ?? []).map((r) => projectTrack(r as Record<string, unknown>)),
            pagination: { limit, offset, total: count ?? null },
          });
        } catch (e) {
          return errorResponse(e instanceof Error ? e.message : "Server error", 500);
        }
      },
    },
  },
});
