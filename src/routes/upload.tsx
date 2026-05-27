import { createFileRoute } from "@tanstack/react-router";
import { Upload as UploadIcon } from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/upload")({
  head: () => ({
    meta: [
      { title: "Upload — Soundloom Core" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <ProtectedRoute>
      <UploadPage />
    </ProtectedRoute>
  ),
});

function UploadPage() {
  const { user } = useAuth();
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <div className="rounded-xl border border-border bg-card p-6 shadow-lg">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <UploadIcon className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-lg font-semibold">Upload</h1>
            <p className="text-xs text-muted-foreground">
              Signed in as {user?.name || user?.email}
            </p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Upload tooling will appear here. Authenticated backend calls will use your Supabase access token automatically.
        </p>
      </div>
    </div>
  );
}