import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Body = {
  prompt: string;
  aspect?: "1:1" | "16:9" | "3:2";
};

function bad(msg: string, status = 400) {
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

export const Route = createFileRoute("/api/generate-artwork")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const userId = await verifyUser(request.headers.get("authorization"));
        if (!userId) return bad("Unauthorized", 401);

        let body: Body;
        try {
          body = (await request.json()) as Body;
        } catch {
          return bad("Invalid JSON");
        }
        if (
          typeof body.prompt !== "string" ||
          body.prompt.trim().length < 3 ||
          body.prompt.length > 2000
        ) {
          return bad("Invalid prompt");
        }
        const aspect: "1:1" | "16:9" | "3:2" =
          body.aspect === "16:9" || body.aspect === "3:2" ? body.aspect : "1:1";

        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) return bad("Missing LOVABLE_API_KEY", 500);

        const text = `${body.prompt.trim()}\n\nAspect ratio: ${aspect}. Professional, high quality. No text, no watermarks.`;

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
              messages: [{ role: "user", content: [{ type: "text", text }] }],
              modalities: ["image", "text"],
              stream: true,
            }),
            signal: request.signal,
          },
        );

        if (!upstream.ok || !upstream.body) {
          const t = await upstream.text().catch(() => "");
          console.error(`[generate-artwork] upstream ${upstream.status}: ${t}`);
          if (upstream.status === 402) {
            return bad("Slut på AI-credits. Lägg till credits i Lovable workspace.", 402);
          }
          if (upstream.status === 429) {
            return bad("För många AI-anrop just nu, försök igen om en stund.", 429);
          }
          return bad(t || `AI gateway error ${upstream.status}`, upstream.status);
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