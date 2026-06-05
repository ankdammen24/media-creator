import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { Loader2, Upload as UploadIcon, X } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import {
  createUploadSession,
  completeUpload,
  type UploadSessionTrack,
} from "@/lib/api-creator";
import { putFileToR2, AUDIO_ACCEPT, MAX_FILE_BYTES, formatBytes } from "@/lib/upload";

export const Route = createFileRoute("/_authenticated/upload")({
  component: UploadPage,
});

type Row = {
  id: string;
  file: File;
  percent: number;
  status: "queued" | "uploading" | "completing" | "done" | "failed";
  trackId?: string;
  error?: string;
};

function UploadPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next: Row[] = [];
    for (const file of Array.from(list)) {
      if (file.size > MAX_FILE_BYTES) {
        next.push({
          id: crypto.randomUUID(),
          file,
          percent: 0,
          status: "failed",
          error: `File too large (${formatBytes(file.size)}, max ${formatBytes(MAX_FILE_BYTES)})`,
        });
      } else {
        next.push({ id: crypto.randomUUID(), file, percent: 0, status: "queued" });
      }
    }
    setRows((prev) => [...prev, ...next]);
  }

  function removeRow(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  async function startUpload() {
    setGlobalError(null);
    const ready = rows.filter((r) => r.status === "queued");
    if (ready.length === 0) return;
    setBusy(true);

    try {
      const session = await createUploadSession(
        ready.map((r) => ({
          filename: r.file.name,
          size: r.file.size,
          contentType: r.file.type || "application/octet-stream",
        })),
      );

      // Pair API uploads with rows by filename (1-to-1 in arrival order is the contract).
      const pairs: Array<{ row: Row; upload: UploadSessionTrack }> = [];
      session.uploads.forEach((u, i) => {
        const row = ready[i];
        if (row) pairs.push({ row, upload: u });
      });

      await Promise.all(
        pairs.map(async ({ row, upload }) => {
          updateRow(row.id, { status: "uploading", trackId: upload.trackId });
          try {
            await putFileToR2(upload, row.file, (p) =>
              updateRow(row.id, { percent: p.percent }),
            );
            updateRow(row.id, { status: "completing", percent: 100 });
            await completeUpload(upload.trackId);
            updateRow(row.id, { status: "done" });
          } catch (e) {
            updateRow(row.id, {
              status: "failed",
              error: e instanceof Error ? e.message : "Upload failed",
            });
          }
        }),
      );

      // If anything succeeded, jump to the processing screen so we can poll.
      const doneIds = rows
        .map((r) => r.trackId)
        .filter((id): id is string => typeof id === "string");
      if (doneIds.length > 0) {
        router.navigate({ to: "/processing" });
      }
    } catch (e) {
      setGlobalError(e instanceof Error ? e.message : "Could not start upload session");
    } finally {
      setBusy(false);
    }
  }

  function updateRow(id: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  const hasQueued = rows.some((r) => r.status === "queued");

  return (
    <PageContainer>
      <PageHeader
        title="Upload Music"
        description="Select one or more audio files. They upload directly to secure storage and start processing automatically."
      />

      <div className="rounded-xl border-2 border-dashed border-border bg-card p-8 text-center">
        <UploadIcon className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-3 text-sm text-foreground">Drag & drop audio files here</p>
        <p className="mt-1 text-xs text-muted-foreground">WAV, FLAC, AIFF, MP3, M4A — up to {formatBytes(MAX_FILE_BYTES)} each</p>
        <Button type="button" variant="outline" className="mt-4" onClick={() => inputRef.current?.click()}>
          Choose files
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={AUDIO_ACCEPT}
          multiple
          className="sr-only"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {globalError ? (
        <p className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {globalError}
        </p>
      ) : null}

      {rows.length > 0 ? (
        <div className="mt-6 space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{r.file.name}</div>
                  <div className="text-xs text-muted-foreground">{formatBytes(r.file.size)}</div>
                </div>
                <RowStatus row={r} />
                {r.status === "queued" || r.status === "failed" ? (
                  <button
                    type="button"
                    onClick={() => removeRow(r.id)}
                    className="rounded-md p-1 text-muted-foreground hover:bg-secondary"
                    aria-label="Remove"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
              {r.status === "uploading" || r.status === "completing" ? (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${r.percent}%` }}
                  />
                </div>
              ) : null}
              {r.error ? <p className="mt-1 text-xs text-destructive">{r.error}</p> : null}
            </div>
          ))}

          <div className="flex justify-end pt-2">
            <Button type="button" onClick={startUpload} disabled={busy || !hasQueued}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Start upload"}
            </Button>
          </div>
        </div>
      ) : null}
    </PageContainer>
  );
}

function RowStatus({ row }: { row: Row }) {
  const map: Record<Row["status"], string> = {
    queued: "Queued",
    uploading: `${row.percent}%`,
    completing: "Finalising…",
    done: "Done",
    failed: "Failed",
  };
  const color: Record<Row["status"], string> = {
    queued: "text-muted-foreground",
    uploading: "text-primary",
    completing: "text-primary",
    done: "text-emerald-500",
    failed: "text-destructive",
  };
  return <span className={`text-xs font-medium ${color[row.status]}`}>{map[row.status]}</span>;
}
