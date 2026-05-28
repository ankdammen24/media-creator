import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, CheckCircle2, XCircle, Music2, Mic, Loader2, Users, Radio, ImagePlus, FileSpreadsheet, Waves } from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { notifySubmissionDecision } from "@/lib/notifications.functions";
import { runAzuracastImport } from "@/lib/azuracast-import.functions";
import { AdminAutoArtwork } from "@/components/AdminAutoArtwork";
import { AdminOwnershipLog } from "@/components/AdminOwnershipLog";
import { AdminUsers } from "@/components/AdminUsers";
import { AdminCatalogImport } from "@/components/AdminCatalogImport";
import { AdminAudioProcessing } from "@/components/AdminAudioProcessing";
import { reassignArtistOwner } from "@/lib/admin-ownership.functions";
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
        .select("id, name, bio, user_id, approval_status, rejection_reason")
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

  const reassignFn = useServerFn(reassignArtistOwner);
  // pending = { artistId, newUserId } chosen but not yet confirmed
  const [pending, setPending] = useState<{
    artistId: string;
    artistName: string;
    fromUserId: string;
    newUserId: string;
  } | null>(null);
  const [preview, setPreview] = useState<{
    counts: { albums: number; submissions: number; images: number };
  } | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openConfirm(
    artistId: string,
    artistName: string,
    fromUserId: string,
    newUserId: string,
  ) {
    setPending({ artistId, artistName, fromUserId, newUserId });
    setPreview(null);
    setReason("");
    setError(null);
    setBusy(true);
    try {
      const res = await reassignFn({
        data: { artistId, newUserId, preview: true },
      });
      if (res.preview) setPreview({ counts: res.counts });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function confirmReassign() {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      const res = await reassignFn({
        data: {
          artistId: pending.artistId,
          newUserId: pending.newUserId,
          reason: reason.trim() || undefined,
        },
      });
      setPending(null);
      setPreview(null);
      setReason("");
      await refetch();
      qc.invalidateQueries({ queryKey: ["catalog"] });
      qc.invalidateQueries({ queryKey: ["admin-ownership-log"] });
      qc.invalidateQueries({ queryKey: ["artist", pending.artistId] });
      window.alert(
        res.noop
          ? "Ingen ändring (samma ägare)."
          : `Flyttade ${res.counts.albums} album, ${res.counts.submissions} låtar och ${res.counts.images} bilder.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
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

  async function moderateAccount(
    artistId: string,
    next: "approved" | "rejected",
  ) {
    let reason: string | null = null;
    if (next === "rejected") {
      reason = window.prompt("Orsak till avslag (visas för artisten):", "") || null;
    }
    const { error } = await supabase
      .from("artist_profiles")
      .update({
        approval_status: next,
        rejection_reason: next === "rejected" ? reason : null,
      })
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

  const pendingArtists = (artists ?? []).filter(
    (a) => a.approval_status === "pending",
  );

  return (
    <div className="space-y-6">
    {pendingArtists.length > 0 && (
      <div className="rounded-xl border border-primary/40 bg-primary/5 p-4">
        <h3 className="mb-3 text-sm font-semibold">
          Väntande artistansökningar ({pendingArtists.length})
        </h3>
        <ul className="space-y-3">
          {pendingArtists.map((a) => (
            <li
              key={a.id}
              className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <h4 className="truncate text-base font-semibold">{a.name}</h4>
                {a.bio && (
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{a.bio}</p>
                )}
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Sökande: {users?.find((u) => u.user_id === a.user_id)?.display_name ?? a.user_id}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => moderateAccount(a.id, "approved")}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Godkänn
                </button>
                <button
                  onClick={() => moderateAccount(a.id, "rejected")}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary"
                >
                  <XCircle className="h-3.5 w-3.5" /> Avslå
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    )}
    <ul className="space-y-3">
      {(artists ?? []).map((a) => (
        <li
          key={a.id}
          className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-base font-semibold">{a.name}</h3>
              <AccountStatusBadge status={a.approval_status} />
            </div>
            <p className="text-xs text-muted-foreground">
              Owner: {users?.find((u) => u.user_id === a.user_id)?.display_name ?? a.user_id}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {a.approval_status !== "approved" && (
              <button
                onClick={() => moderateAccount(a.id, "approved")}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Godkänn
              </button>
            )}
            {a.approval_status === "approved" && (
              <button
                onClick={() => moderateAccount(a.id, "rejected")}
                className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary"
              >
                Återkalla
              </button>
            )}
            <button
              onClick={() => rename(a.id, a.name)}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary"
            >
              Rename
            </button>
            <ReassignControl
              artist={a}
              users={users ?? []}
              onPick={(newUserId) =>
                openConfirm(a.id, a.name, a.user_id, newUserId)
              }
            />
          </div>
        </li>
      ))}
      {(artists ?? []).length === 0 && (
        <p className="text-sm text-muted-foreground">No artist profiles.</p>
      )}
    </ul>

    {pending && (
      <ConfirmReassignDialog
        pending={pending}
        users={users ?? []}
        preview={preview}
        busy={busy}
        error={error}
        reason={reason}
        onReason={setReason}
        onCancel={() => {
          setPending(null);
          setPreview(null);
          setError(null);
        }}
        onConfirm={confirmReassign}
      />
    )}

    <AdminOwnershipLog />
    </div>
  );
}

function ReassignControl({
  artist,
  users,
  onPick,
}: {
  artist: { id: string; user_id: string };
  users: Array<{ user_id: string; display_name: string | null }>;
  onPick: (newUserId: string) => void;
}) {
  const [value, setValue] = useState(artist.user_id);
  return (
    <div className="flex items-center gap-2">
      <select
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
      >
        {users.map((u) => (
          <option key={u.user_id} value={u.user_id}>
            {u.display_name ?? u.user_id}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={value === artist.user_id}
        onClick={() => onPick(value)}
        className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
      >
        Byt ägare
      </button>
    </div>
  );
}

function ConfirmReassignDialog({
  pending,
  users,
  preview,
  busy,
  error,
  reason,
  onReason,
  onCancel,
  onConfirm,
}: {
  pending: { artistId: string; artistName: string; fromUserId: string; newUserId: string };
  users: Array<{ user_id: string; display_name: string | null }>;
  preview: { counts: { albums: number; submissions: number; images: number } } | null;
  busy: boolean;
  error: string | null;
  reason: string;
  onReason: (v: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const fromName = users.find((u) => u.user_id === pending.fromUserId)?.display_name ?? pending.fromUserId;
  const toName = users.find((u) => u.user_id === pending.newUserId)?.display_name ?? pending.newUserId;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl">
        <h3 className="mb-2 text-base font-semibold">Byta ägare?</h3>
        <p className="text-sm text-muted-foreground">
          Du flyttar <span className="font-medium text-foreground">{pending.artistName}</span> från{" "}
          <span className="font-medium text-foreground">{fromName}</span> till{" "}
          <span className="font-medium text-foreground">{toName}</span>.
        </p>
        <div className="mt-3 rounded-md border border-border bg-background p-3 text-xs">
          {preview ? (
            <ul className="space-y-0.5 text-muted-foreground">
              <li>Album som flyttas: <span className="text-foreground font-medium">{preview.counts.albums}</span></li>
              <li>Låtar / submissions: <span className="text-foreground font-medium">{preview.counts.submissions}</span></li>
              <li>EPK-bilder: <span className="text-foreground font-medium">{preview.counts.images}</span></li>
            </ul>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Räknar påverkade rader…
            </div>
          )}
        </div>
        <label className="mt-4 block text-xs font-medium">Anledning (valfritt)</label>
        <input
          type="text"
          value={reason}
          onChange={(e) => onReason(e.target.value)}
          maxLength={500}
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          placeholder="t.ex. artisten har bytt konto"
        />
        {error && (
          <p className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
            {error}
          </p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-md border border-border px-3 py-2 text-xs hover:bg-accent disabled:opacity-50"
          >
            Avbryt
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy || !preview}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Bekräfta ägarbyte
          </button>
        </div>
      </div>
    </div>
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
  artist_profile_id: string;
  album_id: string | null;
  artist_profiles: { name: string } | null;
};

function AdminPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"pending_review" | "approved" | "rejected">("pending_review");
  const [tab, setTab] = useState<
    "submissions" | "users" | "artists" | "artwork" | "import" | "catalog-import" | "audio"
  >("submissions");
  const notify = useServerFn(notifySubmissionDecision);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-submissions", filter],
    queryFn: async (): Promise<PendingSubmission[]> => {
      const { data, error } = await supabase
        .from("submissions")
        .select(
          "id, title, description, media_type, status, audio_path, artwork_path, user_id, created_at, artist_profile_id, album_id, artist_profiles!submissions_artist_profile_id_fkey(name)",
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
          onClick={() => setTab("users")}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
            tab === "users" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Users className="h-3.5 w-3.5" /> Users
        </button>
        <button
          onClick={() => setTab("artwork")}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
            tab === "artwork" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <ImagePlus className="h-3.5 w-3.5" /> Auto-omslag
        </button>
        <button
          onClick={() => setTab("import")}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
            tab === "import" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Radio className="h-3.5 w-3.5" /> Import Radio Uppsala
        </button>
        <button
          onClick={() => setTab("catalog-import")}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
            tab === "catalog-import" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <FileSpreadsheet className="h-3.5 w-3.5" /> Katalog-import
        </button>
        <button
          onClick={() => setTab("audio")}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
            tab === "audio" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Waves className="h-3.5 w-3.5" /> Ljud-bearbetning
        </button>
      </div>

      {tab === "audio" ? (
        <AdminAudioProcessing />
      ) : tab === "catalog-import" ? (
        <AdminCatalogImport />
      ) : tab === "import" ? (
        <RadioUppsalaImport />
      ) : tab === "artwork" ? (
        <AdminAutoArtwork />
      ) : tab === "artists" ? (
        <ArtistsAdmin />
      ) : tab === "users" ? (
        <AdminUsers />
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

function RadioUppsalaImport() {
  const runImport = useServerFn(runAzuracastImport);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Awaited<ReturnType<typeof runAzuracastImport>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(dryRun: boolean) {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await runImport({ data: { dryRun } });
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-1 text-base font-semibold">En-gångs import från Radio Uppsala</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Hämtar alla musikspår från <code className="rounded bg-secondary px-1">stream.radiouppsala.se</code>.
          Filer laddas ner och sparas i denna katalogs egen storage. Spår &lt; 40s och program/intervjuer/arkiv
          hoppas över. Importen är idempotent — redan importerade spår hoppas över.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => run(true)}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-secondary disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Förhandsvisa (dry run)
          </button>
          <button
            onClick={() => run(false)}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Radio className="h-3.5 w-3.5" />}
            Kör import
          </button>
        </div>
        {busy && (
          <p className="mt-3 text-xs text-muted-foreground">
            Kör… det kan ta flera minuter. Stäng inte fliken.
          </p>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {result && (
        <div className="rounded-xl border border-border bg-card p-5 text-sm">
          <h3 className="mb-2 font-semibold">
            {result.dryRun ? "Förhandsvisning" : "Resultat"}
          </h3>
          <ul className="space-y-1 text-muted-foreground">
            <li>Totalt i AzuraCast: {result.total}</li>
            <li>Skulle/blev importerade: {result.dryRun ? result.considered : result.inserted}</li>
            <li>Redan importerade (hoppade över): {result.skippedExisting}</li>
            <li>Hoppade över (program/intervju/arkiv): {result.skippedNonMusic}</li>
            <li>Hoppade över (&lt;40s): {result.skippedShort}</li>
            <li>Misslyckade: {result.failed}</li>
          </ul>
          {result.failures.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-medium text-foreground">
                Visa misslyckanden ({result.failures.length})
              </summary>
              <ul className="mt-2 space-y-1 text-xs">
                {result.failures.slice(0, 50).map((f, i) => (
                  <li key={i} className="text-muted-foreground">
                    <span className="font-mono">{f.azId}</span>
                    {f.title ? ` — ${f.title}` : ""} → {f.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}