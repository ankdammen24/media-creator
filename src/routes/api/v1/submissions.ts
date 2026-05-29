import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { authenticateApiKey, requireScope } from "@/lib/api-auth.server";
import { V1_CORS, errorResponse, jsonResponse, optionsResponse } from "@/lib/api-cors";

const createSchema = z.object({
  artist_profile_id: z.string().uuid(),
  title: z.string().trim().min(1).max(255),
  media_type: z.enum(["music", "podcast"]),
  audio_path: z.string().min(1).max(500),
  artwork_path: z.string().min(1).max(500),
  album_id: z.string().uuid().nullable().optional(),
  description: z.string().max(5000).nullable().optional(),
  isrc: z.string().max(32).nullable().optional(),
  explicit: z.boolean().optional(),
});

export const Route = createFileRoute("/api/v1/submissions")({
  server: {
    handlers: {
      OPTIONS: async () => optionsResponse(V1_CORS),
      GET: async ({ request }) => {
        const auth = await authenticateApiKey(request);
        if ("error" in auth) return auth.error;
        const scopeErr = requireScope(auth, "read:catalog");
        if (scopeErr) return scopeErr;
        let query = supabaseAdmin
          .from("submissions")
          .select("id, title, status, media_type, artist_profile_id, album_id, created_at, approved_at")
          .order("created_at", { ascending: false })
          .limit(100);
        if (auth.type === "user" && auth.ownerUserId) {
          query = query.eq("user_id", auth.ownerUserId);
        }
        const { data, error } = await query;
        if (error) return errorResponse(error.message, 500, V1_CORS);
        return jsonResponse({ data: data ?? [] }, { cors: V1_CORS });
      },
      POST: async ({ request }) => {
        const auth = await authenticateApiKey(request);
        if ("error" in auth) return auth.error;
        const scopeErr = requireScope(auth, "write:submissions");
        if (scopeErr) return scopeErr;
        if (auth.type === "user" && !auth.ownerUserId) {
          return errorResponse("User key missing owner", 400, V1_CORS);
        }
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return errorResponse("Invalid JSON", 400, V1_CORS);
        }
        const parsed = createSchema.safeParse(body);
        if (!parsed.success) return errorResponse(parsed.error.message, 400, V1_CORS);

        // Resolve user_id: user keys → owner; service keys → must belong to the artist profile owner
        let userId = auth.ownerUserId;
        if (auth.type === "service") {
          const { data: ap } = await supabaseAdmin
            .from("artist_profiles")
            .select("user_id")
            .eq("id", parsed.data.artist_profile_id)
            .maybeSingle();
          if (!ap) return errorResponse("Artist not found", 404, V1_CORS);
          userId = ap.user_id;
        } else {
          // Verify user owns the artist
          const { data: ap } = await supabaseAdmin
            .from("artist_profiles")
            .select("user_id")
            .eq("id", parsed.data.artist_profile_id)
            .maybeSingle();
          if (!ap || ap.user_id !== auth.ownerUserId) {
            return errorResponse("Forbidden: artist does not belong to key owner", 403, V1_CORS);
          }
        }

        const { data, error } = await supabaseAdmin
          .from("submissions")
          .insert({
            user_id: userId!,
            artist_profile_id: parsed.data.artist_profile_id,
            album_id: parsed.data.album_id ?? null,
            title: parsed.data.title,
            media_type: parsed.data.media_type,
            audio_path: parsed.data.audio_path,
            artwork_path: parsed.data.artwork_path,
            description: parsed.data.description ?? null,
            isrc: parsed.data.isrc ?? null,
            explicit: parsed.data.explicit ?? false,
            status: "pending_review",
          })
          .select("id, title, status, media_type, created_at")
          .single();
        if (error) return errorResponse(error.message, 400, V1_CORS);
        return jsonResponse({ data }, { status: 201, cors: V1_CORS });
      },
    },
  },
});
