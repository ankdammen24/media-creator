import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, CheckCircle2, XCircle, Music2, Mic, Loader2, Users, Radio } from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { notifySubmissionDecision } from "@/lib/notifications.functions";
import { runAzuracastImport } from "@/lib/azuracast-import.functions";
import {
  EditButton,
  EditSubmissionDialog,
  ReplaceArtworkButton,
  DeleteSubmissionButton,
  EditableSubmission,
} from "@/components/SubmissionActions";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Media Rosenqvist" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <ProtectedRoute>
      <AdminGate />
    </ProtectedRoute>
  ),
});

function AdminGate() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    let on = true;
    (async () => {
      if (!user) return;
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (!on) return;
      setIsAdmin(!error && !!data);
    })();
    return () => {
      on = false;
    };
  }, [user]);

  if (isAdmin === null) {
    return <div className="mx-auto max-w-3xl px-4 py-12 text-sm text-muted-foreground">Checking permissions…</div>;
  }
  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <div className="rounded-xl border border-border bg-card p-6 text-sm">
          <h1 className="mb-2 text-lg font-semibold">Admin access required</h1>
          <p className="text-muted-foreground">
            Your account does not have the <code className="rounded bg-secondary px-1">admin</code> role. Ask
            a project owner to grant it via the backend.
          </p>
        </div>
      </div>
    );
  }
  return <AdminPage />;
}

function ArtistsAdmin() {
  const qc = useQueryClient();
  const { data: artists, isLoading, refetch } = useQuery({
    queryKey: ["admin-artists"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("artist_profiles")
        .select("id, name, bio, user_id")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: users } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .order("display_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  async function reassign(artistId: string, newUserId: string) {
    const { error } = await supabase
      .from("artist_profiles")
      .update({ user_id: newUserId })
      .eq("id", artistId);
    if (error) {
      window.alert(error.message);
      return;
    }
    await refetch();
    qc.invalidateQueries({ queryKey: ["catalog"] });
  }

  async function rename(artistId: string, current: string) {
    const next = window.prompt("New artist name:", current);
    if (!next || next.trim() === current) return;
    const { error } = await supabase
      .from("artist_profiles")
      .update({ name: next.trim() })
      .eq("id", artistId);
    if (error) {
      window.alert(error.message);
      return;
    }
    await refetch();
    qc.invalidateQueries({ queryKey: ["catalog"] });
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {(artists ?? []).map((a) => (
        <li
          key={a.id}
          className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold">{a.name}</h3>
            <p className="text-xs text-muted-foreground">
              Owner: {users?.find((u) => u.user_id === a.user_id)?.display_name ?? a.user_id}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => rename(a.id, a.name)}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary"
            >
              Rename
            </button>
            <select
              value={a.user_id}
              onChange={(e) => {
                if (e.target.value !== a.user_id) reassign(a.id, e.target.value);
              }}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
            >
              {(users ?? []).map((u) => (
                <option key={u.user_id} value={u.user_id}>
                  {u.display_name ?? u.user_id}
                </option>
              ))}
            </select>
          </div>
        </li>
      ))}
      {(artists ?? []).length === 0 && (
        <p className="text-sm text-muted-foreground">No artist profiles.</p>
      )}
    </ul>
  );
}

type PendingSubmission = {
  id: string;
  title: string;
  description: string | null;
  media_type: "music" | "podcast";
  status: "pending_review" | "approved" | "rejected";
  audio_path: string;
  artwork_path: string;
  created_at: string;
  user_id: string;
  artist_profiles: { name: string } | null;
};

function AdminPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"pending_review" | "approved" | "rejected">("pending_review");
  const [tab, setTab] = useState<"submissions" | "artists" | "import">("submissions");
  const notify = useServerFn(notifySubmissionDecision);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-submissions", filter],
    queryFn: async (): Promise<PendingSubmission[]> => {
      const { data, error } = await supabase
        .from("submissions")
        .select(
          "id, title, description, media_type, status, audio_path, artwork_path, user_id, created_at, artist_profiles(name)",
        )
        .eq("status", filter)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PendingSubmission[];
    },
  });

  const [editing, setEditing] = useState<EditableSubmission | null>(null);

  async function moderate(id: string, status: "approved" | "rejected") {
    let reason: string | null = null;
    if (status === "rejected") {
      reason = window.prompt("Optional rejection reason:") || null;
    }
    const { error } = await supabase
      .from("submissions")
      .update({
        status,
        rejection_reason: status === "rejected" ? reason : null,
        reviewed_by: user?.id ?? null,
        reviewed_at: new Date().toISOString(),
        approved_at: status === "approved" ? new Date().toISOString() : null,
        approved_by: status === "approved" ? (user?.id ?? null) : null,
      })
      .eq("id", id);
    if (error) {
      window.alert(error.message);
      return;
    }
    try {
      await notify({ data: { submissionId: id, status, comment: reason } });
    } catch (e) {
      console.error("notifySubmissionDecision failed", e);
    }
    await refetch();
    qc.invalidateQueries({ queryKey: ["catalog"] });
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="mb-6 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <ShieldCheck className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
          <p className="text-xs text-muted-foreground">Moderate submissions and manage artist profiles.</p>
        </div>
      </div>

      <div className="mb-6 inline-flex rounded-lg border border-border bg-card p-1">
        <button
          onClick={() => setTab("submissions")}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
            tab === "submissions" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <ShieldCheck className="h-3.5 w-3.5" /> Submissions
        </button>
        <button
          onClick={() => setTab("artists")}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
            tab === "artists" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Users className="h-3.5 w-3.5" /> Artists
        </button>
        <button
          onClick={() => setTab("import")}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
            tab === "import" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Radio className="h-3.5 w-3.5" /> Import Radio Uppsala
        </button>
      </div>

      {tab === "import" ? (
        <RadioUppsalaImport />
      ) : tab === "artists" ? (
        <ArtistsAdmin />
      ) : (
        <>
      <div className="mb-6 inline-flex rounded-lg border border-border bg-card p-1">
        {(["pending_review", "approved", "rejected"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition ${
              filter === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {s.replace("_", " ")}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (data ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing here.</p>
      ) : (
        <ul className="space-y-3">
          {data!.map((s) => (
            <SubmissionRow
              key={s.id}
              sub={s}
              onModerate={moderate}
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
        </>
      )}
    </div>
  );
}

function SubmissionRow({
  sub,
  onModerate,
  onEdit,
  onChanged,
}: {
  sub: PendingSubmission;
  onModerate: (id: string, status: "approved" | "rejected") => Promise<void>;
  onEdit: () => void;
  onChanged: () => void;
}) {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const artUrl = supabase.storage.from("artwork").getPublicUrl(sub.artwork_path).data.publicUrl;
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let on = true;
    supabase.storage
      .from("audio")
      .createSignedUrl(sub.audio_path, 3600)
      .then(({ data }) => {
        if (on && data) setAudioUrl(data.signedUrl);
      });
    return () => {
      on = false;
    };
  }, [sub.audio_path]);

  async function act(status: "approved" | "rejected") {
    setBusy(true);
    try {
      await onModerate(sub.id, status);
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 sm:flex-row">
      <img src={artUrl} alt={sub.title} className="h-32 w-32 shrink-0 rounded-md object-cover" />
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
          {sub.media_type === "music" ? <Music2 className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
          {sub.media_type}
          <span>·</span>
          <span>{new Date(sub.created_at).toLocaleDateString()}</span>
        </div>
        <h2 className="truncate text-base font-semibold">{sub.title}</h2>
        <p className="text-xs text-muted-foreground">{sub.artist_profiles?.name ?? "Unknown artist"}</p>
        {sub.description && (
          <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{sub.description}</p>
        )}
        {audioUrl && (
          <audio controls src={audioUrl} className="mt-3 h-9 w-full max-w-md">
            Your browser does not support audio.
          </audio>
        )}
        {sub.status === "pending_review" && (
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => act("approved")}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Approve
            </button>
            <button
              onClick={() => act("rejected")}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-md border border-destructive px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
            >
              <XCircle className="h-3.5 w-3.5" /> Reject
            </button>
          </div>
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