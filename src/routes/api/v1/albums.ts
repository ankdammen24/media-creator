import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { authenticateApiKey, requireScope } from "@/lib/api-auth.server";
import { V1_CORS, errorResponse, jsonResponse, optionsResponse } from "@/lib/api-cors";

const createSchema = z.object({
  artist_profile_id: z.string().uuid(),
  title: z.string().trim().min(1).max(255),
  album_type: z.enum(["album", "ep", "single", "compilation", "podcast"]).optional(),
  release_date: z.string().nullable().optional(),
  upc: z.string().max(32).nullable().optional(),
  genre: z.string().max(80).nullable().optional(),
  language: z.string().max(16).nullable().optional(),
  label: z.string().max(120).nullable().optional(),
  description: z.string().max(5000).nullable().optional(),
});

export const Route = createFileRoute("/api/v1/albums")({
  server: {
    handlers: {
      OPTIONS: async () => optionsResponse(V1_CORS),
      GET: async ({ request }) => {
        const auth = await authenticateApiKey(request);
        if ("error" in auth) return auth.error;
        const scopeErr = requireScope(auth, "read:catalog");
        if (scopeErr) return scopeErr;
        let query = supabaseAdmin
          .from("albums")
          .select("id, title, status, album_type, artist_profile_id, release_date, upc, created_at")
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
        const scopeErr = requireScope(auth, "write:albums");
        if (scopeErr) return scopeErr;
        let body: unknown;
        try { body = await request.json(); } catch { return errorResponse("Invalid JSON", 400, V1_CORS); }
        const parsed = createSchema.safeParse(body);
        if (!parsed.success) return errorResponse(parsed.error.message, 400, V1_CORS);

        let userId = auth.ownerUserId;
        const { data: ap } = await supabaseAdmin
          .from("artist_profiles")
          .select("user_id")
          .eq("id", parsed.data.artist_profile_id)
          .maybeSingle();
        if (!ap) return errorResponse("Artist not found", 404, V1_CORS);
        if (auth.type === "user" && ap.user_id !== auth.ownerUserId) {
          return errorResponse("Forbidden: artist does not belong to key owner", 403, V1_CORS);
        }
        if (auth.type === "service") userId = ap.user_id;

        const { data, error } = await supabaseAdmin
          .from("albums")
          .insert({
            user_id: userId!,
            artist_profile_id: parsed.data.artist_profile_id,
            title: parsed.data.title,
            album_type: parsed.data.album_type ?? "album",
            release_date: parsed.data.release_date ?? null,
            upc: parsed.data.upc ?? null,
            genre: parsed.data.genre ?? null,
            language: parsed.data.language ?? null,
            label: parsed.data.label ?? null,
            description: parsed.data.description ?? null,
            status: "draft",
          })
          .select("id, title, status, album_type, created_at")
          .single();
        if (error) return errorResponse(error.message, 400, V1_CORS);
        return jsonResponse({ data }, { status: 201, cors: V1_CORS });
      },
    },
  },
});
