import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AlbumForm } from "@/components/AlbumForm";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState, ErrorState } from "@/components/StateViews";
import type { Album } from "@/lib/album-helpers";

export const Route = createFileRoute("/albums/$albumId/edit")({
  head: () => ({
    meta: [
      { title: "Edit album — Catalogus Musicus" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <ProtectedRoute>
      <EditAlbumPage />
    </ProtectedRoute>
  ),
});

function EditAlbumPage() {
  const { albumId } = Route.useParams();
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["album", albumId],
    queryFn: async (): Promise<Album | null> => {
      const { data, error } = await supabase
        .from("albums")
        .select("*")
        .eq("id", albumId)
        .maybeSingle();
      if (error) throw error;
      return (data as Album | null) ?? null;
    },
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link
        to="/albums/$albumId"
        params={{ albumId }}
        className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to album
      </Link>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : error ? (
        <ErrorState error={error as Error} onRetry={() => refetch()} />
      ) : !data ? (
        <EmptyState title="Album not found" />
      ) : (
        <>
          <h1 className="mb-6 text-2xl font-semibold tracking-tight">Edit album</h1>
          <div className="rounded-xl border border-border bg-card p-5">
            <AlbumForm
              existing={data}
              onSaved={(a) => navigate({ to: "/albums/$albumId", params: { albumId: a.id } })}
            />
          </div>
        </>
      )}
    </div>
  );
}