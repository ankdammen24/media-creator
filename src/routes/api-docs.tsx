import { createFileRoute } from "@tanstack/react-router";
import { openapiSpec } from "@/lib/openapi-spec";

export const Route = createFileRoute("/api-docs")({
  head: () => ({
    meta: [
      { title: "API — Catalogus Musicus" },
      { name: "description", content: "Public read API and authenticated v1 API for Catalogus Musicus." },
    ],
  }),
  component: ApiDocsPage,
});

type PathItem = Record<string, { tags?: string[]; summary?: string; security?: unknown[] }>;

function ApiDocsPage() {
  const paths = openapiSpec.paths as Record<string, PathItem>;
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:py-16">
      <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        Catalogus Musicus API
      </h1>
      <p className="mt-4 text-lg text-muted-foreground">
        Open read endpoints for the approved catalog, and authenticated v1 endpoints for
        submissions, audio, stats and moderation.
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        OpenAPI spec:{" "}
        <a className="text-primary hover:underline" href="/api/openapi">
          /api/openapi
        </a>
        . Authenticated endpoints use{" "}
        <code className="rounded bg-secondary px-1.5 py-0.5">Authorization: Bearer cm_live_...</code>
        . Create keys in <a className="text-primary hover:underline" href="/settings">Settings</a>.
      </p>

      <section className="mt-10 space-y-6">
        {Object.entries(paths).map(([path, methods]) => (
          <div key={path} className="rounded-lg border border-border bg-secondary/30 p-4">
            <code className="text-sm font-semibold text-foreground">{path}</code>
            <ul className="mt-3 space-y-2">
              {Object.entries(methods).map(([method, op]) => (
                <li key={method} className="flex flex-wrap items-baseline gap-2 text-sm">
                  <span className="rounded bg-primary/10 px-2 py-0.5 font-mono text-xs uppercase text-primary">
                    {method}
                  </span>
                  <span className="text-foreground/80">{op.summary ?? ""}</span>
                  <span className="text-xs text-muted-foreground">
                    {op.security && (op.security as unknown[]).length === 0 ? "public" : "auth required"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </div>
  );
}
