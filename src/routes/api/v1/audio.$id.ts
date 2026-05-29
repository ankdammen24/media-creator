import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { authenticateApiKey, requireScope } from "@/lib/api-auth.server";
import { V1_CORS, errorResponse, jsonResponse, optionsResponse } from "@/lib/api-cors";

export const Route = createFileRoute("/api/v1/audio/$id")({
  server: {
    handlers: {
      OPTIONS: async () => optionsResponse(V1_CORS),
      GET: async ({ request, params }) => {
        const auth = await authenticateApiKey(request);
        if ("error" in auth) return auth.error;

        const url = new URL(request.url);
        const variant = url.searchParams.get("variant") === "master" ? "master" : "web";
        const requiredScope = variant === "master" ? "read:audio:master" : "read:audio:web";
        const scopeErr = requireScope(auth, requiredScope);
        if (scopeErr) return scopeErr;

        const { data: sub, error } = await supabaseAdmin
          .from("submissions")
          .select("id, user_id, status, audio_path, audio_web_path, audio_master_path")
          .eq("id", params.id)
          .maybeSingle();
        if (error) return errorResponse(error.message, 500, V1_CORS);
        if (!sub) return errorResponse("Not found", 404, V1_CORS);

        // user keys: only own submissions OR public if approved + web variant
        if (auth.type === "user") {
          const isOwn = sub.user_id === auth.ownerUserId;
          if (!isOwn && !(sub.status === "approved" && variant === "web")) {
            return errorResponse("Forbidden", 403, V1_CORS);
          }
        }

        const path =
          variant === "master"
            ? sub.audio_master_path ?? sub.audio_path
            : sub.audio_web_path ?? sub.audio_path;
        if (!path) return errorResponse("No audio available", 404, V1_CORS);

        const { data: signed, error: sErr } = await supabaseAdmin.storage
          .from("audio")
          .createSignedUrl(path, 300);
        if (sErr || !signed) return errorResponse(sErr?.message ?? "Signing failed", 500, V1_CORS);

        return jsonResponse(
          { data: { url: signed.signedUrl, expires_in_seconds: 300, variant } },
          { cors: V1_CORS },
        );
      },
    },
  },
});
