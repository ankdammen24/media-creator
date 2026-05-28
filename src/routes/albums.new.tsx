import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AlbumForm } from "@/components/AlbumForm";

export const Route = createFileRoute("/albums/new")({
  validateSearch: (search: Record<string, unknown>) => ({
    artistId: typeof search.artistId === "string" ? search.artistId : undefined,
  }),
  head: () => ({
    meta: [
      { title: "New album — Media Rosenqvist" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <ProtectedRoute>
      <NewAlbumPage />
    </ProtectedRoute>
  ),
});

function NewAlbumPage() {
  const { artistId } = Route.useSearch();
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link
        to="/my-submissions"
        className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back
      </Link>
      <h1 className="mb-2 text-2xl font-semibold tracking-tight">Create album</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Albums group your tracks. Even a single belongs to an album.
      </p>
      <div className="rounded-xl border border-border bg-card p-5">
        <AlbumForm lockArtistId={artistId} />
      </div>
    </div>
  );
}