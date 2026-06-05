import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSubmitTrack, useTrackStatus, useUpdateTrackMetadata } from "@/lib/api-creator";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/tracks/$trackId")({ component: TrackDetailPage });

function TrackDetailPage() {
  const { trackId } = Route.useParams();
  const status = useTrackStatus(trackId);
  const update = useUpdateTrackMetadata(trackId);
  const submit = useSubmitTrack(trackId);
  const track = status.data?.track;
  const [title, setTitle] = useState("");
  const [isrc, setIsrc] = useState("");
  const [upc, setUpc] = useState("");
  const [metadataJson, setMetadataJson] = useState("{}");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!track) return;
    setTitle(track.title ?? "");
    setIsrc(track.isrc ?? "");
    setUpc(track.upc ?? "");
    setMetadataJson(JSON.stringify(track.metadata ?? {}, null, 2));
  }, [track]);

  async function onSave(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    let metadata: Record<string, unknown> = {};
    try {
      metadata = metadataJson.trim() ? JSON.parse(metadataJson) : {};
    } catch {
      setMessage("Metadata måste vara giltig JSON.");
      return;
    }
    try {
      await update.mutateAsync({ title, isrc: isrc || null, upc: upc || null, metadata });
      setMessage("Metadata sparad i backend.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Kunde inte spara metadata");
    }
  }

  async function onSubmit() {
    setMessage(null);
    try {
      await submit.mutateAsync();
      setMessage("Spåret skickades in för granskning.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Kunde inte skicka in spåret");
    }
  }

  return (
    <PageContainer>
      <PageHeader title={track?.title || "Metadata"} description="Redigera metadata. Backend validerar och avgör när spåret kan skickas vidare." actions={track ? <Badge variant={track.status === "failed" ? "destructive" : "secondary"}>{track.status}</Badge> : undefined} />
      {status.isLoading ? <p className="text-sm text-muted-foreground">Hämtar spår…</p> : status.error ? <p className="text-sm text-destructive">{status.error instanceof Error ? status.error.message : "Kunde inte hämta spår"}</p> : <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <form onSubmit={onSave} className="space-y-5 rounded-xl border border-border bg-card p-6">
          <div className="space-y-1.5"><Label htmlFor="title">Titel</Label><Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Spårtitel" /></div>
          <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="isrc">ISRC</Label><Input id="isrc" value={isrc} onChange={(e) => setIsrc(e.target.value)} /></div><div className="space-y-1.5"><Label htmlFor="upc">UPC</Label><Input id="upc" value={upc} onChange={(e) => setUpc(e.target.value)} /></div></div>
          <div className="space-y-1.5"><Label htmlFor="metadata">Metadata JSON</Label><Textarea id="metadata" className="min-h-48 font-mono text-xs" value={metadataJson} onChange={(e) => setMetadataJson(e.target.value)} /></div>
          <div className="flex flex-wrap items-center gap-3"><Button type="submit" disabled={update.isPending}>{update.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Spara metadata"}</Button><Button type="button" variant="outline" onClick={onSubmit} disabled={submit.isPending || track?.status !== "processed"}>{submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Skicka till granskning"}</Button>{message ? <span className="text-sm text-muted-foreground">{message}</span> : null}</div>
        </form>
        <aside className="space-y-4"><section className="rounded-xl border border-border bg-card p-5"><h2 className="font-medium">Filer</h2><ul className="mt-3 space-y-2 text-sm text-muted-foreground">{(status.data?.files ?? []).map((file) => <li key={file.id} className="flex justify-between gap-3"><span>{file.filename}</span><span>{file.file_type ?? file.fileType}</span></li>)}</ul></section><section className="rounded-xl border border-border bg-card p-5"><h2 className="font-medium">Bearbetningsjobb</h2><ul className="mt-3 space-y-2 text-sm text-muted-foreground">{(status.data?.processingJobs ?? status.data?.processing_jobs ?? []).map((job) => <li key={job.id} className="flex justify-between gap-3"><span>{job.id.slice(0, 8)}</span><span>{job.status}</span></li>)}</ul></section></aside>
      </div>}
    </PageContainer>
  );
}
