import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState, useEffect, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, ArrowLeft, Send } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  getTrack,
  updateTrackMetadata,
  submitTrack,
  type TrackMetadataPatch,
} from "@/lib/api-creator";

export const Route = createFileRoute("/_authenticated/tracks/$trackId")({
  component: TrackEditorPage,
});

function TrackEditorPage() {
  const { trackId } = Route.useParams();
  const router = useRouter();
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["track", trackId],
    queryFn: () => getTrack(trackId),
  });

  const update = useMutation({
    mutationFn: (patch: TrackMetadataPatch) => updateTrackMetadata(trackId, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["track", trackId] });
      qc.invalidateQueries({ queryKey: ["tracks"] });
    },
  });

  const submit = useMutation({
    mutationFn: () => submitTrack(trackId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["track", trackId] });
      qc.invalidateQueries({ queryKey: ["tracks"] });
    },
  });

  const [form, setForm] = useState<TrackMetadataPatch>({});
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  useEffect(() => {
    if (data?.track) {
      setForm({
        title: data.track.title ?? "",
        artist: data.track.artist ?? "",
        isrc: data.track.isrc ?? "",
        explicit: data.track.explicit ?? false,
        language: data.track.language ?? "",
        primaryGenre: data.track.primaryGenre ?? "",
        secondaryGenre: data.track.secondaryGenre ?? "",
      });
    }
  }, [data?.track]);

  if (isLoading) {
    return (
      <PageContainer>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      </PageContainer>
    );
  }
  if (error || !data) {
    return (
      <PageContainer>
        <p className="text-sm text-destructive">{error instanceof Error ? error.message : "Track not found"}</p>
        <Link to="/tracks" className="mt-2 inline-block text-sm text-primary hover:underline">
          Back to tracks
        </Link>
      </PageContainer>
    );
  }

  const { track } = data;
  const canSubmit =
    track.status === "processed" || track.status === "rejected";

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setSaveMsg(null);
    try {
      await update.mutateAsync(form);
      setSaveMsg("Saved.");
    } catch (e) {
      setSaveMsg(e instanceof Error ? e.message : "Save failed");
    }
  }

  async function onSubmit() {
    try {
      await submit.mutateAsync();
      router.navigate({ to: "/tracks" });
    } catch (e) {
      setSaveMsg(e instanceof Error ? e.message : "Submit failed");
    }
  }

  return (
    <PageContainer>
      <Link
        to="/tracks"
        className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All tracks
      </Link>

      <PageHeader
        title={track.title || "Untitled track"}
        description={`Status: ${track.status.replace(/_/g, " ")}`}
        actions={
          <Button type="button" disabled={!canSubmit || submit.isPending} onClick={onSubmit}>
            {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Submit for review
          </Button>
        }
      />

      <form
        onSubmit={onSave}
        className="grid gap-5 rounded-xl border border-border bg-card p-6 md:grid-cols-2"
      >
        <Field label="Title">
          <Input
            value={form.title ?? ""}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </Field>
        <Field label="Artist">
          <Input
            value={form.artist ?? ""}
            onChange={(e) => setForm({ ...form, artist: e.target.value })}
          />
        </Field>
        <Field label="ISRC">
          <Input
            value={form.isrc ?? ""}
            onChange={(e) => setForm({ ...form, isrc: e.target.value })}
            placeholder="XX-XXX-YY-NNNNN"
          />
        </Field>
        <Field label="Language">
          <Input
            value={form.language ?? ""}
            onChange={(e) => setForm({ ...form, language: e.target.value })}
            placeholder="sv, en, …"
          />
        </Field>
        <Field label="Primary genre">
          <Input
            value={form.primaryGenre ?? ""}
            onChange={(e) => setForm({ ...form, primaryGenre: e.target.value })}
          />
        </Field>
        <Field label="Secondary genre">
          <Input
            value={form.secondaryGenre ?? ""}
            onChange={(e) => setForm({ ...form, secondaryGenre: e.target.value })}
          />
        </Field>
        <Field label="Description" full>
          <Textarea
            rows={3}
            value={form.description ?? ""}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </Field>
        <label className="flex items-center gap-2 text-sm md:col-span-2">
          <input
            type="checkbox"
            checked={form.explicit ?? false}
            onChange={(e) => setForm({ ...form, explicit: e.target.checked })}
            className="h-4 w-4 rounded border-border"
          />
          Explicit content
        </label>

        <div className="flex items-center gap-3 md:col-span-2">
          <Button type="submit" disabled={update.isPending}>
            {update.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save metadata"}
          </Button>
          {saveMsg ? <span className="text-xs text-muted-foreground">{saveMsg}</span> : null}
        </div>
      </form>

      {track.status === "rejected" ? (
        <p className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          This track was rejected. Update the metadata and resubmit.
        </p>
      ) : null}
    </PageContainer>
  );
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={`space-y-1.5 ${full ? "md:col-span-2" : ""}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
