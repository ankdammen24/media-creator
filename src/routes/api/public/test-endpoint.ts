import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/test-endpoint")({
  server: {
    handlers: {
      GET: async () => {
        const url = process.env.AUDIO_PROCESSOR_URL || "not-set";
        const endpoint = url.trim().replace(/\/+$/, "");
        const final = /\/process$/i.test(endpoint) ? endpoint : `${endpoint}/process`;
        return new Response(JSON.stringify({ url, endpoint: final }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
