// Weekly cron pull of Radio Uppsala play history. Called by pg_cron via
// pg_net.http_post with the Supabase anon key in an apikey header.
import { createFileRoute } from "@tanstack/react-router";
import { performRadioSpinsImport } from "@/lib/radio-spins-import.server";

export const Route = createFileRoute("/api/public/hooks/import-radio-uppsala")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY;
        const got = request.headers.get("apikey");
        if (!expected || got !== expected) {
          return new Response("unauthorized", { status: 401 });
        }
        try {
          const summary = await performRadioSpinsImport();
          return Response.json({ ok: true, summary });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return new Response(`import failed: ${msg}`, { status: 500 });
        }
      },
    },
  },
});