import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Loader2, UploadCloud, X } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AUDIO_ACCEPT, formatBytes, putFileToR2, validateAudioFile } from "@/lib/upload";
import { completeUpload, createUploadSession, type UploadSessionUpload } from "@/lib/api-creator";

export const Route = createFileRoute("/_authenticated/upload")({ component: UploadPage });

type Row = { id: string; file: File; error: string | null; status: "vald" | "laddar_upp" | "bekräftar" | "klar" | "fel"; percent: number; trackId?: string };

function UploadPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const hasValidFiles = useMemo(() => rows.some((row) => !row.error), [rows]);

  function addFiles(fileList: FileList | null) {
    if (!fileList) return;
    const next = Array.from(fileList).map((file) => ({ id: crypto.randomUUID(), file, error: validateAudioFile(file), status: "vald" as const, percent: 0 }));
    setRows((current) => [...current, ...next]);
    setGlobalError(null);
  }

  function updateRow(id: string, patch: Partial<Row>) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  async function startUpload() {
    const validRows = rows.filter((row) => !row.error);
    if (validRows.length === 0) return;
    setBusy(true);
    setGlobalError(null);
    const completedTrackIds: string[] = [];
    try {
      const session = await createUploadSession(validRows.map(({ file }) => ({ filename: file.name, contentType: file.type, size: file.size })));
      const pairs = session.uploads.map((upload, index) => ({ upload, row: validRows[index] })).filter((pair): pair is { upload: UploadSessionUpload; row: Row } => Boolean(pair.row));
      await Promise.all(pairs.map(async ({ row, upload }) => {
        updateRow(row.id, { status: "laddar_upp", trackId: upload.trackId });
        await putFileToR2(upload, row.file, (percent) => updateRow(row.id, { percent }));
        updateRow(row.id, { status: "bekräftar", percent: 100 });
        await completeUpload({ trackId: upload.trackId, fileId: upload.fileId, r2Key: upload.r2Key });
        completedTrackIds.push(upload.trackId);
        updateRow(row.id, { status: "klar" });
      }));
      router.navigate({ to: "/processing", search: { trackIds: completedTrackIds.join(",") } });
    } catch (error) {
      setGlobalError(error instanceof Error ? error.message : "Uppladdningen kunde inte startas");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageContainer>
      <PageHeader title="Ladda upp musik" description="Välj en eller flera ljudfiler. Portalen begär uppladdningssession från API:t, laddar upp till R2 med presignerad URL och bekräftar sedan uppladdningen." />
      <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
        <UploadCloud className="mx-auto h-10 w-10 text-muted-foreground" />
        <p className="mt-3 text-sm text-muted-foreground">Stöder WAV, MP3, FLAC och AIFF. Max {formatBytes(500 * 1024 * 1024)} per fil.</p>
        <label className="mt-5 inline-flex cursor-pointer rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          Välj filer
          <input className="sr-only" type="file" accept={AUDIO_ACCEPT} multiple onChange={(event) => addFiles(event.target.files)} />
        </label>
      </div>
      {rows.length > 0 ? <div className="mt-6 space-y-3">{rows.map((row) => <div key={row.id} className="rounded-xl border border-border bg-card p-4"><div className="flex items-start justify-between gap-3"><div><div className="font-medium">{row.file.name}</div><div className="text-xs text-muted-foreground">{formatBytes(row.file.size)} · {row.file.type || "okänd typ"}</div>{row.error ? <div className="mt-1 text-xs text-destructive">{row.error}</div> : null}</div><button type="button" className="rounded p-1 text-muted-foreground hover:bg-secondary" onClick={() => setRows((current) => current.filter((item) => item.id !== row.id))} disabled={busy}><X className="h-4 w-4" /></button></div><div className="mt-3 flex items-center gap-3"><Progress value={row.percent} className="h-2" /><span className="w-24 text-right text-xs text-muted-foreground">{statusLabel(row)}</span></div></div>)}</div> : null}
      {globalError ? <p className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{globalError}</p> : null}
      <div className="mt-6 flex justify-end"><Button disabled={!hasValidFiles || busy} onClick={startUpload}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Starta uppladdning"}</Button></div>
    </PageContainer>
  );
}

function statusLabel(row: Row) {
  if (row.error) return "Ogiltig";
  if (row.status === "laddar_upp") return `${row.percent}%`;
  if (row.status === "bekräftar") return "Bekräftar";
  if (row.status === "klar") return "Klar";
  if (row.status === "fel") return "Fel";
  return "Vald";
}
