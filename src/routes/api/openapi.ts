import { createFileRoute } from "@tanstack/react-router";
import { openapiSpec } from "@/lib/openapi-spec";

export const Route = createFileRoute("/api/openapi")({
  server: {
    handlers: {
      GET: async () =>
        new Response(JSON.stringify(openapiSpec), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "public, max-age=300",
          },
        }),
    },
  },
});
