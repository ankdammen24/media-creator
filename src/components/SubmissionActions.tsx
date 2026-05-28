import { useEffect, useState } from "react";
import { Pencil, Trash2, ImageUp, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { nextTrackNumber } from "@/lib/album-helpers";

export type EditableSubmission = {
  id: string;
  title: string;
  description: string | null;
  media_type: "music" | "podcast";
  artwork_path: string;
  audio_path: string;
  status: string;
  user_id: string;
  artist_profile_id: string;
  album_id: string | null;
};

type AlbumOption = { id: string; title: string };

export function EditSubmissionDialog({
  sub,
  onClose,
  onSaved,
}: {
  sub: EditableSubmission;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(sub.title);
  const [description, setDescription] = useState(sub.description ?? "");
  const [mediaType, setMediaType] = useState<"music" | "podcast">(sub.media_type);
  const [albumId, setAlbumId] = useState<string>(sub.album_id ?? "");
  const [albums, setAlbums] = useState<AlbumOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let on = true;
    (async () => {
      const { data } = await supabase
        .from("albums")
        .select("id, title")
        .eq("artist_profile_id", sub.artist_profile_id)
        .order("title", { ascending: true });
      if (on) setAlbums((data ?? []) as AlbumOption[]);
    })();
    return () => {
      on = false;
    };
  }, [sub.artist_profile_id]);

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      const patch: Record<string, unknown> = {
        title: title.trim(),
        description: description.trim() || null,
        media_type: mediaType,
      };
      const nextAlbum = albumId || null;
      const prevAlbum = sub.album_id ?? null;
      if (nextAlbum !== prevAlbum) {
        patch.album_id = nextAlbum;
        patch.track_number = nextAlbum ? await nextTrackNumber(nextAlbum) : null;
      }
      const { error } = await supabase.from("submissions").update(patch).eq("id", sub.id);
      if (error) throw error;
      onSaved();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-border bg-card p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-4 text-base font-semibold">Edit submission</h3>
        <div className="space-y-3">
          <label className="block text-xs">
            <span className="mb-1 block text-muted-foreground">Title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            />
          </label>
          <label className="block text-xs">
            <span className="mb-1 block text-muted-foreground">Description</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            />
          </label>
          <label className="block text-xs">
            <span className="mb-1 block text-muted-foreground">Media type</span>
            <select
              value={mediaType}
              onChange={(e) => setMediaType(e.target.value as "music" | "podcast")}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            >
              <option value="music">Music</option>
              <option value="podcast">Podcast</option>
            </select>
          </label>
          <label className="block text-xs">
            <span className="mb-1 block text-muted-foreground">Album</span>
            <select
              value={albumId}
              onChange={(e) => setAlbumId(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            >
              <option value="">— Inget album —</option>
              {albums.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                </option>
              ))}
            </select>
          </label>
          {err && <p className="text-xs text-destructive">{err}</p>}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={busy}
            className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-secondary"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={busy || !title.trim()}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save
          </button>
        </div>
      </div>
    </div>
  );
}

export function ReplaceArtworkButton({
  sub,
  onDone,
}: {
  sub: EditableSubmission;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${sub.user_id}/${sub.id}-${Date.now()}.${ext}`;
      const up = await supabase.storage.from("artwork").upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (up.error) throw up.error;
      const upd = await supabase
        .from("submissions")
        .update({ artwork_path: path })
        .eq("id", sub.id);
      if (upd.error) throw upd.error;
      // best-effort delete old artwork
      await supabase.storage.from("artwork").remove([sub.artwork_path]);
      onDone();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-secondary">
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <ImageUp className="h-3.5 w-3.5" />
      )}
      Replace artwork
      <input
        type="file"
        accept="image/*"
        className="hidden"
        disabled={busy}
        onChange={pick}
      />
    </label>
  );
}

export function DeleteSubmissionButton({
  sub,
  onDeleted,
}: {
  sub: EditableSubmission;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!window.confirm(`Delete "${sub.title}"? This cannot be undone.`)) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("submissions").delete().eq("id", sub.id);
      if (error) throw error;
      await Promise.all([
        supabase.storage.from("audio").remove([sub.audio_path]),
        supabase.storage.from("artwork").remove([sub.artwork_path]),
      ]);
      onDeleted();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={remove}
      disabled={busy}
      className="inline-flex items-center gap-1.5 rounded-md border border-destructive px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
      Delete
    </button>
  );
}

export function EditButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-secondary"
    >
      <Pencil className="h-3.5 w-3.5" /> Edit
    </button>
  );
}