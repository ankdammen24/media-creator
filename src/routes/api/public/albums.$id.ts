import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { PUBLIC_CORS, errorResponse, jsonResponse, optionsResponse } from "@/lib/api-cors";
import {
  PUBLIC_ALBUM_COLUMNS,
  PUBLIC_TRACK_COLUMNS,
  projectAlbum,
  projectTrack,
} from "@/lib/api-projections";

export const Route = createFileRoute("/api/public/albums/$id")({
  server: {
    handlers: {
      OPTIONS: async () => optionsResponse(PUBLIC_CORS),
      GET: async ({ params }) => {
        const { data: album, error } = await supabaseAdmin
          .from("albums")
          .select(PUBLIC_ALBUM_COLUMNS)
          .eq("id", params.id)
          .eq("status", "published")
          .maybeSingle();
        if (error) return errorResponse(error.message, 500);
        if (!album) return errorResponse("Not found", 404);
        const { data: tracks } = await supabaseAdmin
          .from("submissions")
          .select(PUBLIC_TRACK_COLUMNS)
          .eq("album_id", params.id)
          .eq("status", "approved")
          .order("track_number", { ascending: true, nullsFirst: false });
        return jsonResponse({
          data: {
            ...projectAlbum(album as Record<string, unknown>),
            tracks: (tracks ?? []).map((r) => projectTrack(r as Record<string, unknown>)),
          },
        });
      },
    },
  },
});
