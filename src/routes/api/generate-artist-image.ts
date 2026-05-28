import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";

type Body = {
  artistId: string;
  prompt: string;
  kind: "avatar" | "cover" | "press";
  referenceImagePath?: string | null;
};

const ASPECT_BY_KIND: Record<Body["kind"], string> = {
  avatar: "1:1",
  cover: "16:9",
  press: "3:2",
};

function badRequest(msg: string, status = 400) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function verifyUser(authHeader: string | null): Promise<string | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  if (!token) return null;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  const c = createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await c.auth.getClaims(token);
  if (error || !data?.claims?.sub) return null;
  return data.claims.sub as string;
}

async function canEditArtist(userId: string, artistId: string): Promise<boolean> {
  const [{ data: artist }, { data: adminRow }] = await Promise.all([
    supabaseAdmin
      .from("artist_profiles")
      .select("user_id")
      .eq("id", artistId)
      .maybeSingle(),
    supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle(),
  ]);
  if (artist?.user_id === userId) return true;
  if (adminRow) return true;
  return false;
}

export const Route = createFileRoute("/api/generate-artist-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const userId = await verifyUser(request.headers.get("authorization"));
        if (!userId) return badRequest("Unauthorized", 401);

        let body: Body;
        try {
          body = (await request.json()) as Body;
        } catch {
          return badRequest("Invalid JSON");
        }

        if (
          !body.artistId ||
          typeof body.prompt !== "string" ||
          body.prompt.trim().length < 3 ||
          body.prompt.length > 2000 ||
          !["avatar", "cover", "press"].includes(body.kind)
        ) {
          return badRequest("Invalid input");
        }

        const allowed = await canEditArtist(userId, body.artistId);
        if (!allowed) return badRequest("Forbidden", 403);

        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) return badRequest("Missing LOVABLE_API_KEY", 500);

        // Build content for Gemini: optional reference image + prompt
        const content: Array<
          | { type: "text"; text: string }
          | { type: "image_url"; image_url: { url: string } }
        > = [];
        if (body.referenceImagePath) {
          // Only allow paths under the artwork bucket
          const { data: signed } = await supabaseAdmin.storage
            .from("artwork")
            .createSignedUrl(body.referenceImagePath, 300);
          if (signed?.signedUrl) {
            content.push({ type: "image_url", image_url: { url: signed.signedUrl } });
          }
        }
        const aspect = ASPECT_BY_KIND[body.kind];
        content.push({
          type: "text",
          text: `${body.prompt.trim()}\n\nAspect ratio: ${aspect}. Professional, high quality.`,
        });

        console.log(
          `[generate-artist-image] user=${userId} artist=${body.artistId} kind=${body.kind} ref=${!!body.referenceImagePath}`,
        );

        const upstream = await fetch(
          "https://ai.gateway.lovable.dev/v1/images/generations",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-3.1-flash-image-preview",
              messages: [{ role: "user", content }],
              modalities: ["image", "text"],
              stream: true,
            }),
            signal: request.signal,
          },
        );

        if (!upstream.ok || !upstream.body) {
          const text = await upstream.text().catch(() => "");
          console.error(`[generate-artist-image] upstream ${upstream.status}: ${text}`);
          if (upstream.status === 402) {
            return badRequest(
              "Slut på AI-credits. Lägg till credits i Lovable workspace.",
              402,
            );
          }
          if (upstream.status === 429) {
            return badRequest("För många AI-anrop just nu, försök igen om en stund.", 429);
          }
          return badRequest(text || `AI gateway error ${upstream.status}`, upstream.status);
        }

        return new Response(upstream.body, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        });
      },
    },
  },
});