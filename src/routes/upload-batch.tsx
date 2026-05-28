import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import {
  Upload as UploadIcon,
  X,
  CheckCircle2,
  AlertCircle,
  Mic,
  User as UserIcon,
  Image as ImageIcon,
  Layers,
  Trash2,
  Loader2,
  Sparkles,
} from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { ShowPicker } from "@/components/ShowPicker";
import { nextEpisodeNumber } from "@/lib/podcast-helpers";
import { AiArtworkDialog } from "@/components/AiArtworkDialog";
import { useServerFn } from "@tanstack/react-start";

type ArtistProfile = { id: string; name: string; bio: string | null };

const AUDIO_EXTS = ["wav", "flac", "aiff", "aif", "mp3", "m4a"];
const AUDIO_ACCEPT =
  ".wav,.flac,.aiff,.aif,.mp3,.m4a,audio/wav,audio/flac,audio/aiff,audio/mpeg,audio/mp4";
const IMAGE_EXTS = ["jpg", "jpeg", "png", "webp"];
const IMAGE_ACCEPT = ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp";
const MAX_AUDIO_BYTES = 500 * 1024 * 1024;
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
function extOf(name: string) {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}
function sanitize(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
}
function baseName(name: string) {
  const i = name.lastIndexOf(".");
  return (i >= 0 ? name.slice(0, i) : name).replace(/[_-]+/g, " ").trim();
}

type DraftStatus =
  | "queued"
  | "uploading"
  | "ready"
  | "submitting"
  | "submitted"
  | "error";

type Draft = {
  id: string;
  file: File;
  audioPath: string | null;
  uploadPct: number;
  status: DraftStatus;
  errorMsg: string | null;
  selected: boolean;
  // metadata
  title: string;
  description: string;
  artwork: File | null;
  artworkError: string | null;
};

export const Route = createFileRoute("/upload-batch")({
  head: () => ({
    meta: [
      { title: "Batch upload — Media Rosenqvist Catalog" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <ProtectedRoute>
      <BatchUploadPage />
    </ProtectedRoute>
  ),
});

function BatchUploadPage() {
  const { user } = useAuth();
  const enqueueAudio = useServerFn(enqueueAudioProcessing);

  // Profiles
  const [profiles, setProfiles] = useState<ArtistProfile[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [profilesError, setProfilesError] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string>("");
  const [showId, setShowId] = useState<string>("");

  useEffect(() => {
    setShowId("");
  }, [profileId]);

  // Shared metadata defaults
  const [sharedArtwork, setSharedArtwork] = useState<File | null>(null);
  const [sharedArtworkError, setSharedArtworkError] = useState<string | null>(null);
  const [sharedAiOpen, setSharedAiOpen] = useState(false);

  const primaryArtistName = profiles.find((p) => p.id === profileId)?.name ?? "";

  // Drafts
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [submitSummary, setSubmitSummary] = useState<{ ok: number; failed: number } | null>(null);

  useEffect(() => {
    let on = true;
    (async () => {
      try {
        setProfilesLoading(true);
        if (!user) return;
        const { data, error } = await supabase
          .from("artist_profiles")
          .select("id, name, bio")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true });
        if (!on) return;
        if (error) throw error;
        const items = (data ?? []) as ArtistProfile[];
        setProfiles(items);
        if (items.length === 1) setProfileId(items[0].id);
      } catch (e) {
        if (on) setProfilesError(e instanceof Error ? e.message : "Could not load profiles");
      } finally {
        if (on) setProfilesLoading(false);
      }
    })();
    return () => {
      on = false;
    };
  }, [user]);

  function onPickSharedArtwork(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    if (!f) {
      setSharedArtwork(null);
      setSharedArtworkError(null);
      return;
    }
    if (!IMAGE_EXTS.includes(extOf(f.name))) {
      setSharedArtworkError(`Unsupported image format. Allowed: ${IMAGE_EXTS.join(", ").toUpperCase()}.`);
      setSharedArtwork(null);
      return;
    }
    if (f.size > MAX_IMAGE_BYTES) {
      setSharedArtworkError(`Artwork too large (${formatBytes(f.size)}). Max ${formatBytes(MAX_IMAGE_BYTES)}.`);
      setSharedArtwork(null);
      return;
    }
    setSharedArtwork(f);
    setSharedArtworkError(null);
  }

  async function onPickAudios(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!user || !files.length) return;

    const newDrafts: Draft[] = files.map((f) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      file: f,
      audioPath: null,
      uploadPct: 0,
      status: AUDIO_EXTS.includes(extOf(f.name)) && f.size <= MAX_AUDIO_BYTES ? "queued" : "error",
      errorMsg: AUDIO_EXTS.includes(extOf(f.name))
        ? f.size > MAX_AUDIO_BYTES
          ? `Too large (${formatBytes(f.size)})`
          : null
        : `Unsupported format`,
      selected: true,
      title: baseName(f.name),
      description: "",
      artwork: null,
      artworkError: null,
    }));

    setDrafts((cur) => [...cur, ...newDrafts]);

    // Upload sequentially to avoid hammering storage.
    for (const d of newDrafts) {
      if (d.status === "error") continue;
      await uploadDraft(d);
    }
  }

  async function uploadDraft(d: Draft) {
    if (!user) return;
    setDrafts((cur) =>
      cur.map((x) => (x.id === d.id ? { ...x, status: "uploading", uploadPct: 10, errorMsg: null } : x)),
    );
    try {
      const stamp = Date.now();
      const audioPath = `${user.id}/batch-${stamp}-${sanitize(d.file.name)}`;
      const up = await supabase.storage.from("audio").upload(audioPath, d.file, {
        cacheControl: "3600",
        upsert: false,
        contentType: d.file.type || undefined,
      });
      if (up.error) throw up.error;
      setDrafts((cur) =>
        cur.map((x) =>
          x.id === d.id ? { ...x, status: "ready", uploadPct: 100, audioPath } : x,
        ),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      setDrafts((cur) =>
        cur.map((x) => (x.id === d.id ? { ...x, status: "error", errorMsg: msg } : x)),
      );
    }
  }

  function updateDraft(id: string, patch: Partial<Draft>) {
    setDrafts((cur) => cur.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }

  function setDraftArtwork(id: string, f: File | null) {
    if (!f) {
      updateDraft(id, { artwork: null, artworkError: null });
      return;
    }
    if (!IMAGE_EXTS.includes(extOf(f.name))) {
      updateDraft(id, { artwork: null, artworkError: "Unsupported image format" });
      return;
    }
    if (f.size > MAX_IMAGE_BYTES) {
      updateDraft(id, { artwork: null, artworkError: `Too large (${formatBytes(f.size)})` });
      return;
    }
    updateDraft(id, { artwork: f, artworkError: null });
  }

  async function removeDraft(id: string) {
    const d = drafts.find((x) => x.id === id);
    setDrafts((cur) => cur.filter((x) => x.id !== id));
    if (d?.audioPath) {
      // best-effort cleanup of uploaded but discarded audio
      await supabase.storage.from("audio").remove([d.audioPath]);
    }
  }

  function isDraftSubmittable(d: Draft): boolean {
    if (d.status !== "ready") return false;
    if (!d.audioPath) return false;
    if (!d.title.trim()) return false;
    if (!d.artwork && !sharedArtwork) return false;
    if (d.artworkError) return false;
    return true;
  }

  const allSelected = drafts.length > 0 && drafts.every((d) => d.selected);
  const selectedReadyCount = useMemo(
    () => drafts.filter((d) => d.selected && isDraftSubmittable(d)).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [drafts, sharedArtwork],
  );

  async function submitSelected() {
    if (!user || !profileId) {
      setGlobalError("Choose an artist profile first.");
      return;
    }
    if (!showId) {
      setGlobalError("Pick a show for the episodes.");
      return;
    }
    setGlobalError(null);
    setSubmitSummary(null);

    const toSubmit = drafts.filter((d) => d.selected && isDraftSubmittable(d));
    if (!toSubmit.length) {
      setGlobalError("No selected drafts are ready to submit.");
      return;
    }

    let ok = 0;
    let failed = 0;

    for (const d of toSubmit) {
      updateDraft(d.id, { status: "submitting", errorMsg: null });
      try {
        let artworkPath: string;
        const stamp = Date.now();
        if (d.artwork) {
          artworkPath = `${user.id}/batch-${stamp}-${sanitize(d.artwork.name)}`;
          const up = await supabase.storage.from("artwork").upload(artworkPath, d.artwork, {
            cacheControl: "3600",
            upsert: false,
            contentType: d.artwork.type || undefined,
          });
          if (up.error) throw up.error;
        } else if (sharedArtwork) {
          artworkPath = `${user.id}/batch-shared-${stamp}-${sanitize(sharedArtwork.name)}`;
          const up = await supabase.storage.from("artwork").upload(artworkPath, sharedArtwork, {
            cacheControl: "3600",
            upsert: false,
            contentType: sharedArtwork.type || undefined,
          });
          if (up.error) throw up.error;
        } else {
          throw new Error("Missing artwork");
        }

        const { data: inserted, error: insErr } = await supabase
          .from("submissions")
          .insert({
            user_id: user.id,
            artist_profile_id: profileId,
            media_type: "podcast",
            title: d.title.trim(),
            description: d.description.trim() || null,
            audio_path: d.audioPath!,
            artwork_path: artworkPath,
            status: "pending_review",
            album_id: showId,
            episode_number: await nextEpisodeNumber(showId),
          } as never)
          .select("id")
          .single();
        if (insErr) {
          await supabase.storage.from("artwork").remove([artworkPath]);
          throw insErr;
        }
        if (inserted) {
          await supabase.from("submission_artists").insert({
            submission_id: inserted.id,
            artist_profile_id: profileId,
            is_primary: true,
            position: 0,
          });
        }
        ok += 1;
        updateDraft(d.id, { status: "submitted" });
      } catch (err) {
        failed += 1;
        const msg = err instanceof Error ? err.message : "Submission failed";
        updateDraft(d.id, { status: "ready", errorMsg: msg });
      }
    }

    setSubmitSummary({ ok, failed });
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <ModeTabs current="batch" />

      <div className="mb-8">
        <h1 className="flex items-center gap-2 text-3xl font-semibold tracking-tight">
          <Layers className="h-7 w-7 text-primary" /> Batch upload
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload multiple audio files at once, fill in metadata for each, then submit the ones you&rsquo;re ready with.
        </p>
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            <span className="font-semibold">Demo-läge.</span> Det du laddar upp
            sparas i Media Rosenqvist Catalog och skickas till Radio Uppsala.
            Distribution till Spotify, Apple Music m.fl. är inte aktiv.
          </p>
        </div>
      </div>

      {/* Profile */}
      <Section title="1. Artist profile" icon={<UserIcon className="h-4 w-4" />}>
        {profilesLoading ? (
          <p className="text-sm text-muted-foreground">Loading profiles…</p>
        ) : profiles.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            You don&rsquo;t have any artist profiles yet.{" "}
            <Link to="/upload" className="text-primary underline">
              Create one in the single upload flow
            </Link>{" "}
            and come back.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
            {profiles.map((p) => {
              const active = profileId === p.id;
              return (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => setProfileId(p.id)}
                  className={`flex items-center gap-3 rounded-lg border p-3 text-left transition ${
                    active
                      ? "border-primary bg-primary/10"
                      : "border-border bg-background hover:bg-accent/40"
                  }`}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold">
                    {p.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{p.name}</span>
                    {p.bio && (
                      <span className="block truncate text-xs text-muted-foreground">{p.bio}</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        )}
        {profilesError && <p className="mt-2 text-xs text-destructive">{profilesError}</p>}
      </Section>

      {/* Shared settings */}
      <Section title="2. Shared settings (optional)" icon={<ImageIcon className="h-4 w-4" />}>
        {profileId && (
          <div className="mb-4 rounded-lg border border-border bg-background/40 p-3">
            <label className="mb-2 block text-sm font-medium">
              Show for episodes <span className="text-destructive">*</span>
            </label>
            <ShowPicker artistId={profileId} value={showId} onChange={setShowId} />
            <p className="mt-2 text-xs text-muted-foreground">
              Required. Episode numbers are auto-assigned.
            </p>
          </div>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <span className="mb-2 block text-sm font-medium">Shared artwork</span>
            {!sharedArtwork ? (
              <label className="flex h-24 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-border bg-background px-4 text-center hover:bg-accent/40">
                <ImageIcon className="h-5 w-5 text-muted-foreground" />
                <span className="mt-1 text-sm font-medium">Choose shared artwork</span>
                <span className="text-xs text-muted-foreground">
                  Used for any item without its own artwork
                </span>
                <input
                  type="file"
                  accept={IMAGE_ACCEPT}
                  onChange={onPickSharedArtwork}
                  className="sr-only"
                />
              </label>
            ) : (
              <SharedArtworkPreview file={sharedArtwork} onRemove={() => setSharedArtwork(null)} />
            )}
            {sharedArtworkError && (
              <p className="mt-1 text-xs text-destructive">{sharedArtworkError}</p>
            )}
            <button
              type="button"
              onClick={() => setSharedAiOpen(true)}
              className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:bg-accent"
            >
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Skapa delat omslag med AI
            </button>
          </div>
        </div>
      </Section>

      {/* Pick audios */}
      <Section title="3. Select audio files" icon={<UploadIcon className="h-4 w-4" />}>
        <label className="flex h-32 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-border bg-background px-4 text-center hover:bg-accent/40">
          <UploadIcon className="h-6 w-6 text-muted-foreground" />
          <span className="mt-2 text-sm font-medium">
            Add audio files {drafts.length > 0 ? "(more)" : ""}
          </span>
          <span className="mt-1 text-xs text-muted-foreground">
            {AUDIO_EXTS.join(", ").toUpperCase()} — up to {formatBytes(MAX_AUDIO_BYTES)} each
          </span>
          <input
            type="file"
            accept={AUDIO_ACCEPT}
            multiple
            onChange={onPickAudios}
            className="sr-only"
          />
        </label>
      </Section>

      {/* Drafts list */}
      {drafts.length > 0 && (
        <Section
          title={`4. Drafts (${drafts.length})`}
          icon={<Layers className="h-4 w-4" />}
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(e) =>
                  setDrafts((cur) => cur.map((x) => ({ ...x, selected: e.target.checked })))
                }
              />
              Select all
            </label>
            <span className="text-muted-foreground">
              {selectedReadyCount} selected & ready to submit
            </span>
          </div>

          <ul className="space-y-3">
            {drafts.map((d) => (
              <DraftRow
                key={d.id}
                d={d}
                hasSharedArtwork={!!sharedArtwork}
                artistName={primaryArtistName}
                onChange={(p) => updateDraft(d.id, p)}
                onArtwork={(f) => setDraftArtwork(d.id, f)}
                onRemove={() => removeDraft(d.id)}
                onRetryUpload={() => uploadDraft(d)}
              />
            ))}
          </ul>
        </Section>
      )}

      {/* Submit */}
      {drafts.length > 0 && (
        <Section title="5. Submit selected for review" icon={<CheckCircle2 className="h-4 w-4" />}>
          {globalError && (
            <div className="mb-3 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{globalError}</p>
            </div>
          )}
          {submitSummary && (
            <div className="mb-3 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
              Submitted {submitSummary.ok} item{submitSummary.ok === 1 ? "" : "s"} for review
              {submitSummary.failed > 0 ? `, ${submitSummary.failed} failed.` : "."}{" "}
              <span className="text-amber-700 dark:text-amber-300">
                Sparas i katalogen och skickas till Radio Uppsala — ingen
                streamingdistribution i demo-läget.
              </span>{" "}
              <Link to="/catalog" className="underline">
                Back to catalog
              </Link>
            </div>
          )}
          <button
            type="button"
            onClick={submitSelected}
            disabled={!profileId || selectedReadyCount === 0}
            className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Submit {selectedReadyCount} selected for review
          </button>
        </Section>
      )}
      <AiArtworkDialog
        open={sharedAiOpen}
        aspect="1:1"
        title="Skapa delat omslag med AI"
        filenameHint={`shared-${primaryArtistName || "artwork"}`}
        defaultPrompt={`Abstrakt delat omslag${primaryArtistName ? ` för ${primaryArtistName}` : ""}, konstnärlig komposition som funkar för flera spår, ingen text, inga ansikten`}
        onClose={() => setSharedAiOpen(false)}
        onGenerated={(file) => {
          setSharedArtwork(file);
          setSharedArtworkError(null);
        }}
      />
    </div>
  );
}

function ModeTabs({ current }: { current: "single" | "batch" }) {
  return (
    <div className="mb-6 inline-flex rounded-lg border border-border bg-card p-1">
      <Link
        to="/upload"
        className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
          current === "single" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        Single upload
      </Link>
      <Link
        to="/upload-batch"
        className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
          current === "batch" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        Batch upload
      </Link>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6 rounded-xl border border-border bg-card p-5 shadow-sm">
      <h2 className="mb-4 flex items-center gap-2 text-base font-semibold">
        <span className="text-muted-foreground">{icon}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function SharedArtworkPreview({ file, onRemove }: { file: File; onRemove: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return (
    <div className="flex items-center gap-3 rounded-md border border-border bg-background p-3">
      {url && <img src={url} alt="Shared artwork" className="h-14 w-14 rounded object-cover" />}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{file.name}</p>
        <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border hover:bg-accent"
        aria-label="Remove shared artwork"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function DraftRow({
  d,
  hasSharedArtwork,
  artistName,
  onChange,
  onArtwork,
  onRemove,
  onRetryUpload,
}: {
  d: Draft;
  hasSharedArtwork: boolean;
  artistName: string;
  onChange: (patch: Partial<Draft>) => void;
  onArtwork: (f: File | null) => void;
  onRemove: () => void;
  onRetryUpload: () => void;
}) {
  const [artUrl, setArtUrl] = useState<string | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  useEffect(() => {
    if (!d.artwork) {
      setArtUrl(null);
      return;
    }
    const u = URL.createObjectURL(d.artwork);
    setArtUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [d.artwork]);

  const statusBadge = (() => {
    switch (d.status) {
      case "queued":
        return <span className="text-muted-foreground">Queued</span>;
      case "uploading":
        return (
          <span className="inline-flex items-center gap-1 text-primary">
            <Loader2 className="h-3 w-3 animate-spin" /> Uploading… {d.uploadPct}%
          </span>
        );
      case "ready":
        return <span className="text-emerald-500">Uploaded · draft</span>;
      case "submitting":
        return (
          <span className="inline-flex items-center gap-1 text-primary">
            <Loader2 className="h-3 w-3 animate-spin" /> Submitting…
          </span>
        );
      case "submitted":
        return <span className="text-emerald-500">Submitted for review</span>;
      case "error":
        return <span className="text-destructive">{d.errorMsg ?? "Error"}</span>;
    }
  })();

  const disabled = d.status === "submitting" || d.status === "submitted";

  return (
    <li className="rounded-lg border border-border bg-background p-4">
      <div className="mb-3 flex flex-wrap items-start gap-3">
        <input
          type="checkbox"
          checked={d.selected}
          disabled={disabled || d.status === "error" || d.status === "uploading"}
          onChange={(e) => onChange({ selected: e.target.checked })}
          className="mt-1"
          aria-label={`Select ${d.title}`}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{d.file.name}</p>
          <p className="text-xs text-muted-foreground">
            {formatBytes(d.file.size)} · {statusBadge}
          </p>
          {d.status === "uploading" && (
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${d.uploadPct}%` }}
              />
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {d.status === "error" && (
            <button
              type="button"
              onClick={onRetryUpload}
              className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
            >
              Retry
            </button>
          )}
          <button
            type="button"
            onClick={onRemove}
            disabled={d.status === "submitting"}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border hover:bg-accent disabled:opacity-60"
            aria-label="Remove draft"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium">Title</label>
          <input
            type="text"
            value={d.title}
            onChange={(e) => onChange({ title: e.target.value })}
            maxLength={200}
            disabled={disabled}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium">Description (optional)</label>
          <textarea
            value={d.description}
            onChange={(e) => onChange({ description: e.target.value })}
            maxLength={2000}
            rows={3}
            disabled={disabled}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
          />

          <div className="mt-3">
            <span className="mb-1 block text-xs font-medium">
              Artwork{" "}
              {hasSharedArtwork && !d.artwork && (
                <span className="font-normal text-muted-foreground">
                  · using shared artwork
                </span>
              )}
            </span>
            {d.artwork ? (
              <div className="flex items-center gap-2 rounded-md border border-border bg-background p-2">
                {artUrl && (
                  <img src={artUrl} alt="Artwork" className="h-10 w-10 rounded object-cover" />
                )}
                <span className="min-w-0 flex-1 truncate text-xs">{d.artwork.name}</span>
                <button
                  type="button"
                  onClick={() => onArtwork(null)}
                  disabled={disabled}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border hover:bg-accent disabled:opacity-60"
                  aria-label="Remove artwork"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <label className="flex h-14 cursor-pointer items-center justify-center rounded-md border border-dashed border-border bg-background px-3 text-xs hover:bg-accent/40">
                <ImageIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                {hasSharedArtwork ? "Override with custom artwork" : "Choose artwork (required)"}
                <input
                  type="file"
                  accept={IMAGE_ACCEPT}
                  onChange={(e) => onArtwork(e.target.files?.[0] ?? null)}
                  disabled={disabled}
                  className="sr-only"
                />
              </label>
            )}
            {d.artworkError && (
              <p className="mt-1 text-xs text-destructive">{d.artworkError}</p>
            )}
            <button
              type="button"
              onClick={() => setAiOpen(true)}
              disabled={disabled}
              className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-xs hover:bg-accent disabled:opacity-50"
            >
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Skapa med AI
            </button>
            <AiArtworkDialog
              open={aiOpen}
              aspect="1:1"
              title="Skapa omslag med AI"
              filenameHint={`track-${d.title || "untitled"}`}
              defaultPrompt={`Abstrakt omslag för låten "${d.title || "låten"}"${artistName ? ` av ${artistName}` : ""}, konstnärlig komposition, ingen text, inga ansikten`}
              onClose={() => setAiOpen(false)}
              onGenerated={(file) => onArtwork(file)}
            />
          </div>
        </div>
      </div>
    </li>
  );
}