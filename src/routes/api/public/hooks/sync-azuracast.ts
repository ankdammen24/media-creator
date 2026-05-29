import { createFileRoute } from "@tanstack/react-router";
import { syncCatalogToAzuracast } from "@/lib/azuracast-sync.server";
import { PUBLIC_CORS, errorResponse, jsonResponse, optionsResponse } from "@/lib/api-cors";

export const Route = createFileRoute("/api/public/hooks/sync-azuracast")({
  server: {
    handlers: {
      OPTIONS: async () => optionsResponse(PUBLIC_CORS),
      POST: async ({ request }) => {
        // pg_cron skickar Supabase anon-nyckeln i "apikey"-headern.
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY;
        const provided = request.headers.get("apikey") ?? "";
        if (!expected || provided !== expected) {
          return errorResponse("Unauthorized", 401);
        }
        try {
          const summary = await syncCatalogToAzuracast({});
          return jsonResponse({ ok: true, summary });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error("sync-azuracast failed:", msg);
          return errorResponse(msg, 500);
        }
      },
    },
  },
});