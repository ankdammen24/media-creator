import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Music2, Mic, Loader2 } from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
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
      { title: "My submissions — Soundloom Core" },
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
          "id, title, description, media_type, status, audio_path, artwork_path, user_id, created_at, artist_profiles(name)",
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
        <h1 className="text-2xl font-semibold tracking-tight">My submissions</h1>
        <p className="text-xs text-muted-foreground">
          Edit details, replace the artwork, or delete a submission.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (data ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">You haven't uploaded anything yet.</p>
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
  const artUrl = supabase.storage.from("artwork").getPublicUrl(sub.artwork_path).data.publicUrl;
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