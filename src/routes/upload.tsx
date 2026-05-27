import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent, type ChangeEvent } from "react";
import { Upload as UploadIcon, X, CheckCircle2, AlertCircle, Copy } from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/lib/auth";
import { apiAuthedUpload } from "@/lib/api";

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

const ALLOWED_EXTS = ["wav", "flac", "aiff", "aif", "mp3"];
const ACCEPT_ATTR =
  ".wav,.flac,.aiff,.aif,.mp3,audio/wav,audio/flac,audio/aiff,audio/mpeg";
const MAX_BYTES = 500 * 1024 * 1024;

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

type UploadResponse = {
  trackId?: string;
  id?: string;
  track?: { id?: string };
};

function pickTrackId(r: UploadResponse): string | null {
  return r.trackId ?? r.id ?? r.track?.id ?? null;
}

function UploadPage() {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [trackId, setTrackId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fileError = (() => {
    if (!file) return null;
    if (!ALLOWED_EXTS.includes(extOf(file.name))) {
      return `Unsupported file type. Allowed: ${ALLOWED_EXTS.join(", ").toUpperCase()}.`;
    }
    if (file.size > MAX_BYTES) {
      return `File is too large (${formatBytes(file.size)}). Max ${formatBytes(MAX_BYTES)}.`;
    }
    return null;
  })();

  const canSubmit =
    status !== "uploading" &&
    title.trim().length > 0 &&
    artist.trim().length > 0 &&
    !!file &&
    !fileError;

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
  }

  function reset() {
    setTitle("");
    setArtist("");
    setFile(null);
    setStatus("idle");
    setProgress(0);
    setTrackId(null);
    setError(null);
    setCopied(false);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit || !file) return;

    setStatus("uploading");
    setProgress(0);
    setError(null);
    setTrackId(null);

    const fd = new FormData();
    fd.append("title", title.trim());
    fd.append("artist", artist.trim());
    fd.append("file", file, file.name);

    try {
      const res = await apiAuthedUpload<UploadResponse>(
        "/upload/audio",
        fd,
        (pct) => setProgress(pct),
      );
      const id = pickTrackId(res);
      if (!id) throw new Error("Upload succeeded but no track ID was returned");
      setTrackId(id);
      setStatus("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setStatus("error");
    }
  }

  async function copyId() {
    if (!trackId) return;
    try {
      await navigator.clipboard.writeText(trackId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* noop */
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <div className="rounded-xl border border-border bg-card p-6 shadow-lg">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <UploadIcon className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-lg font-semibold">Upload audio</h1>
            <p className="text-xs text-muted-foreground">
              Signed in as {user?.name || user?.email}
            </p>
          </div>
        </div>

        {status === "success" && trackId ? (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-5">
            <div className="mb-2 flex items-center gap-2 text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
              <h2 className="font-semibold">Upload complete</h2>
            </div>
            <p className="mb-3 text-sm text-muted-foreground">
              Your track has been received and queued for processing.
            </p>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Track ID:</span>
              <code className="rounded bg-background px-2 py-1 font-mono text-xs">
                {trackId}
              </code>
              <button
                type="button"
                onClick={copyId}
                className="inline-flex items-center gap-1 rounded border border-border bg-background px-2 py-1 text-xs hover:bg-accent"
              >
                <Copy className="h-3 w-3" />
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                to="/catalog"
                className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                View in catalog
              </Link>
              <button
                type="button"
                onClick={reset}
                className="inline-flex items-center justify-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                Upload another
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-5">
            <div>
              <label htmlFor="title" className="mb-1 block text-sm font-medium">
                Title
              </label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                required
                disabled={status === "uploading"}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
              />
            </div>

            <div>
              <label htmlFor="artist" className="mb-1 block text-sm font-medium">
                Artist
              </label>
              <input
                id="artist"
                type="text"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                maxLength={200}
                required
                disabled={status === "uploading"}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
              />
            </div>

            <div>
              <label htmlFor="file" className="mb-1 block text-sm font-medium">
                Audio file
              </label>
              {!file ? (
                <label
                  htmlFor="file"
                  className="flex cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-border bg-background px-4 py-8 text-center hover:bg-accent/40"
                >
                  <UploadIcon className="mb-2 h-6 w-6 text-muted-foreground" />
                  <span className="text-sm font-medium">Choose an audio file</span>
                  <span className="mt-1 text-xs text-muted-foreground">
                    WAV, FLAC, AIFF or MP3 — up to {formatBytes(MAX_BYTES)}
                  </span>
                  <input
                    id="file"
                    type="file"
                    accept={ACCEPT_ATTR}
                    onChange={onFileChange}
                    className="sr-only"
                    disabled={status === "uploading"}
                  />
                </label>
              ) : (
                <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatBytes(file.size)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    disabled={status === "uploading"}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border hover:bg-accent disabled:opacity-60"
                    aria-label="Remove file"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
              {fileError && (
                <p className="mt-1 text-xs text-destructive">{fileError}</p>
              )}
            </div>

            {status === "uploading" && (
              <div>
                <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                  <span>Uploading…</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {status === "error" && error && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {status === "uploading" ? "Uploading…" : "Upload"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}