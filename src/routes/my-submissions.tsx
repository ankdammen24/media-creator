import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Music2, Mic, Loader2, Disc3 } from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { effectiveArtworkPath } from "@/lib/album-helpers";
import {
  EditableSubmission,
  EditButton,
  EditSubmissionDialog,
  ReplaceArtworkButton,
  DeleteSubmissionButton,
} from "@/components/SubmissionActions";

export const Route = createFileRoute("/my-submissions")({
  head: () => ({
    meta: [
      { title: "My submissions — Media Rosenqvist" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <ProtectedRoute>
      <MyPage />
    </ProtectedRoute>
  ),
});

type Row = EditableSubmission & {
  created_at: string;
  artist_profiles: { name: string } | null;
  albums: { artwork_path: string | null } | null;
};

function MyPage() {
  const { user } = useAuth();
  const [editing, setEditing] = useState<EditableSubmission | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["my-submissions", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await supabase
        .from("submissions")
        .select(
          "id, title, description, media_type, status, audio_path, artwork_path, user_id, created_at, artist_profiles!submissions_artist_profile_id_fkey(name), albums(artwork_path)",
        )
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">My submissions</h1>
            <p className="text-xs text-muted-foreground">
              Edit details, replace the artwork, or delete a submission.
            </p>
          </div>
          <Link
            to="/albums/new"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Disc3 className="h-3.5 w-3.5" /> Skapa nytt album
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (data ?? []).length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">You haven't uploaded anything yet.</p>
          <Link
            to="/albums/new"
            className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Disc3 className="h-3.5 w-3.5" /> Skapa nytt album
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {data!.map((s) => (
            <Row
              key={s.id}
              sub={s}
              onEdit={() => setEditing(s)}
              onChanged={() => refetch()}
            />
          ))}
        </ul>
      )}

      {editing && (
        <EditSubmissionDialog
          sub={editing}
          onClose={() => setEditing(null)}
          onSaved={() => refetch()}
        />
      )}
    </div>
  );
}

function Row({
  sub,
  onEdit,
  onChanged,
}: {
  sub: Row;
  onEdit: () => void;
  onChanged: () => void;
}) {
  const artPath = effectiveArtworkPath(sub) ?? sub.artwork_path;
  const artUrl = supabase.storage.from("artwork").getPublicUrl(artPath).data.publicUrl;
  const statusColor =
    sub.status === "approved"
      ? "text-emerald-600"
      : sub.status === "rejected"
      ? "text-destructive"
      : "text-muted-foreground";

  return (
    <li className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 sm:flex-row">
      <img src={artUrl} alt={sub.title} className="h-28 w-28 shrink-0 rounded-md object-cover" />
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
          {sub.media_type === "music" ? <Music2 className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
          {sub.media_type}
          <span>·</span>
          <span className={statusColor}>{sub.status.replace("_", " ")}</span>
          <span>·</span>
          <span>{new Date(sub.created_at).toLocaleDateString()}</span>
        </div>
        <h2 className="truncate text-base font-semibold">{sub.title}</h2>
        <p className="text-xs text-muted-foreground">{sub.artist_profiles?.name ?? "Unknown artist"}</p>
        {sub.description && (
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{sub.description}</p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <EditButton onClick={onEdit} />
          <ReplaceArtworkButton sub={sub} onDone={onChanged} />
          <DeleteSubmissionButton sub={sub} onDeleted={onChanged} />
        </div>
      </div>
    </li>
  );
}