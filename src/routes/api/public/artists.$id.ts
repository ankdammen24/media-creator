import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { PUBLIC_CORS, errorResponse, jsonResponse, optionsResponse } from "@/lib/api-cors";
import {
  PUBLIC_ARTIST_COLUMNS,
  PUBLIC_ALBUM_COLUMNS,
  projectAlbum,
  projectArtist,
} from "@/lib/api-projections";

export const Route = createFileRoute("/api/public/artists/$id")({
  server: {
    handlers: {
      OPTIONS: async () => optionsResponse(PUBLIC_CORS),
      GET: async ({ params }) => {
        const { data: artist, error: aErr } = await supabaseAdmin
          .from("artist_profiles")
          .select(PUBLIC_ARTIST_COLUMNS)
          .eq("id", params.id)
          .eq("approval_status", "approved")
          .maybeSingle();
        if (aErr) return errorResponse(aErr.message, 500);
        if (!artist) return errorResponse("Not found", 404);

        const { data: albums } = await supabaseAdmin
          .from("albums")
          .select(PUBLIC_ALBUM_COLUMNS)
          .eq("artist_profile_id", params.id)
          .eq("status", "published")
          .order("release_date", { ascending: false, nullsFirst: false });

        return jsonResponse({
          data: {
            ...projectArtist(artist as Record<string, unknown>),
            discography: (albums ?? []).map((r) => projectAlbum(r as Record<string, unknown>)),
          },
        });
      },
    },
  },
});
