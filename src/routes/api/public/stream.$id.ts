import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { PUBLIC_CORS, errorResponse, optionsResponse } from "@/lib/api-cors";

const SIGNED_URL_TTL_SECONDS = 60 * 10; // 10 minutes

export const Route = createFileRoute("/api/public/stream/$id")({
  server: {
    handlers: {
      OPTIONS: async () => optionsResponse(PUBLIC_CORS),
      GET: async ({ params }) => {
        const { data, error } = await supabaseAdmin
          .from("submissions")
          .select("audio_web_path, audio_path")
          .eq("id", params.id)
          .eq("status", "approved")
          .maybeSingle();
        if (error) return errorResponse(error.message, 500);
        if (!data) return errorResponse("Not found", 404);

        const path = data.audio_web_path ?? data.audio_path;
        if (!path) return errorResponse("No audio available", 404);

        const { data: signed, error: signErr } = await supabaseAdmin
          .storage
          .from("audio")
          .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
        if (signErr || !signed?.signedUrl) {
          return errorResponse(signErr?.message ?? "Failed to sign URL", 500);
        }

        return new Response(null, {
          status: 302,
          headers: {
            Location: signed.signedUrl,
            "Cache-Control": "no-store",
            ...PUBLIC_CORS,
          },
        });
      },
    },
  },
});