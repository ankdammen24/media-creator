import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type ComponentType } from "react";

export const Route = createFileRoute("/api-docs")({
  head: () => ({
    meta: [
      { title: "API — Catalogus Musicus" },
      { name: "description", content: "Public read API and authenticated v1 API for Catalogus Musicus." },
    ],
  }),
  component: ApiDocsPage,
});

function ApiDocsPage() {
  const [SwaggerUI, setSwaggerUI] = useState<ComponentType<{ url: string }> | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [mod] = await Promise.all([
        import("swagger-ui-react"),
        import("swagger-ui-react/swagger-ui.css"),
      ]);
      if (!cancelled) setSwaggerUI(() => mod.default as ComponentType<{ url: string }>);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Catalogus Musicus API
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Öppna endpoints kräver ingen nyckel. Skyddade endpoints kräver{" "}
          <code className="rounded bg-secondary px-1.5 py-0.5">Authorization: Bearer cm_live_…</code>
          . Skapa personliga nycklar i{" "}
          <a className="text-primary hover:underline" href="/settings">
            Inställningar
          </a>
          .
        </p>
      </div>
      <div className="rounded-xl border border-border bg-white p-2 text-black">
        {SwaggerUI ? (
          <SwaggerUI url="/api/openapi" />
        ) : (
          <p className="p-6 text-sm text-muted-foreground">Laddar dokumentation…</p>
        )}
      </div>
    </div>
  );
}
