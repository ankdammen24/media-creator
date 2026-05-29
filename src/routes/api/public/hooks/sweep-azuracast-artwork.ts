import { createFileRoute } from "@tanstack/react-router";
import { sweepAzuracastTracks, sweepAzuracastAlbums } from "@/lib/artwork-sweep.server";
import { PUBLIC_CORS, errorResponse, jsonResponse, optionsResponse } from "@/lib/api-cors";

// Automatiskt cron-jobb: rensar bort Radio Uppsala/AzuraCast-default-omslag
// genom att hämta riktigt omslag från iTunes → Deezer → MusicBrainz, AI som
// sista utväg. Bara rader vars artwork_path fortfarande ligger under
// `/azuracast/` rörs — redan AI-genererade eller redan utbytta omslag är
// på andra paths och hoppas över.
export const Route = createFileRoute("/api/public/hooks/sweep-azuracast-artwork")({
  server: {
    handlers: {
      OPTIONS: async () => optionsResponse(PUBLIC_CORS),
      POST: async ({ request }) => {
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY;
        const provided = request.headers.get("apikey") ?? "";
        if (!expected || provided !== expected) {
          return errorResponse("Unauthorized", 401);
        }
        try {
          const tracks = await sweepAzuracastTracks(50);
          const albums = await sweepAzuracastAlbums(50);
          console.log(
            `[sweep-azuracast-artwork] tracks scanned=${tracks.scanned} updated=${tracks.updated} failed=${tracks.failed}; albums scanned=${albums.scanned} updated=${albums.updated} failed=${albums.failed}`,
          );
          return jsonResponse({
            ok: true,
            tracks: { scanned: tracks.scanned, updated: tracks.updated, failed: tracks.failed, bySource: tracks.bySource },
            albums: { scanned: albums.scanned, updated: albums.updated, failed: albums.failed, bySource: albums.bySource },
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error("sweep-azuracast-artwork failed:", msg);
          return errorResponse(msg, 500);
        }
      },
    },
  },
});