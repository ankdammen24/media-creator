import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Loader2, UploadCloud, X, ImagePlus, Music } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import {
  AUDIO_ACCEPT,
  COVER_ACCEPT,
  formatBytes,
  uploadAndCreateSubmission,
  validateAudio,
  validateCover,
} from "@/lib/cloud-upload";

export const Route = createFileRoute("/_authenticated/upload-cloud")({
  component: UploadCloudPage,
});

type ArtistOption = { id: string; name: string };

function UploadCloudPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [artists, setArtists] = useState<ArtistOption[]>([]);
  const [artistId, setArtistId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [loadingArtists, setLoadingArtists] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!user?.id) return;
      const { data, error } = await supabase
        .from("artist_profiles")
        .select("id, name, approval_status")
        .eq("user_id", user.id)
        .eq("approval_status", "approved")
        .order("name");
      if (!active) return;
      if (error) {
        setGlobalError(`Could not load your artists: ${error.message}`);
      } else if (data) {
        const opts = data.map((d) => ({ id: d.id as string, name: d.name as string }));
        setArtists(opts);
        if (opts.length === 1) setArtistId(opts[0].id);
      }
      setLoadingArtists(false);
    })();
    return () => {
      active = false;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!coverFile) {
      setCoverPreview(null);
      return;
    }
    const url = URL.createObjectURL(coverFile);
    setCoverPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [coverFile]);

  const canSubmit = useMemo(
    () =>
      Boolean(
        user?.id &&
          artistId &&
          title.trim() &&
          audioFile &&
          coverFile &&
          !audioError &&
          !coverError,
      ),
    [user?.id, artistId, title, audioFile, coverFile, audioError, coverError],
  );

  function handleAudio(file: File | null) {
    setAudioFile(file);
    setAudioError(file ? validateAudio(file) : null);
  }

  function handleCover(file: File | null) {
    setCoverFile(file);
    setCoverError(file ? validateCover(file) : null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !user?.id || !audioFile || !coverFile) return;
    setSubmitting(true);
    setGlobalError(null);
    try {
      const { submissionId } = await uploadAndCreateSubmission({
        userId: user.id,
        artistProfileId: artistId,
        title,
        description: description || null,
        audioFile,
        coverFile,
        mediaType: "music",
      });
      router.navigate({ to: "/tracks/$trackId", params: { trackId: submissionId } });
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title="Upload to Cloud"
        description="Upload audio + cover art directly to shared storage. Creates a submission that admins can review and that will appear in Catalog once approved."
      />

      {loadingArtists ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading your artists…
        </div>
      ) : artists.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-6 text-sm">
          You don't have an approved artist profile yet. Create one in{" "}
          <a href="/account" className="underline">
            Account
          </a>{" "}
          before uploading.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Audio dropzone */}
            <FileZone
              label="Audio file"
              icon={<Music className="h-8 w-8 text-muted-foreground" />}
              hint={`WAV, MP3, FLAC, AIFF · max 500 MB`}
              accept={AUDIO_ACCEPT}
              file={audioFile}
              error={audioError}
              onFile={handleAudio}
              disabled={submitting}
            />
            {/* Cover dropzone */}
            <FileZone
              label="Cover art"
              icon={<ImagePlus className="h-8 w-8 text-muted-foreground" />}
              hint="JPG, PNG, WEBP · max 10 MB · square 3000×3000 recommended"
              accept={COVER_ACCEPT}
              file={coverFile}
              error={coverError}
              onFile={handleCover}
              disabled={submitting}
              preview={coverPreview}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="title">Track title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={submitting}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="artist">Artist</Label>
              <select
                id="artist"
                value={artistId}
                onChange={(e) => setArtistId(e.target.value)}
                disabled={submitting || artists.length === 0}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                required
              >
                <option value="">Choose artist…</option>
                {artists.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={submitting}
              rows={3}
            />
          </div>

          {globalError ? (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {globalError}
            </p>
          ) : null}

          <div className="flex justify-end">
            <Button type="submit" disabled={!canSubmit || submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading…
                </>
              ) : (
                <>
                  <UploadCloud className="mr-2 h-4 w-4" /> Upload & submit
                </>
              )}
            </Button>
          </div>
        </form>
      )}
    </PageContainer>
  );
}

function FileZone({
  label,
  icon,
  hint,
  accept,
  file,
  error,
  onFile,
  disabled,
  preview,
}: {
  label: string;
  icon: React.ReactNode;
  hint: string;
  accept: string;
  file: File | null;
  error: string | null;
  onFile: (file: File | null) => void;
  disabled?: boolean;
  preview?: string | null;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-2 text-sm font-medium">{label}</div>
      {file ? (
        <div className="flex items-start gap-3">
          {preview ? (
            <img src={preview} alt="" className="h-20 w-20 rounded-md object-cover" />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-md bg-secondary">
              {icon}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="truncate text-sm">{file.name}</div>
            <div className="text-xs text-muted-foreground">
              {formatBytes(file.size)} · {file.type || "unknown"}
            </div>
            {error ? (
              <div className="mt-1 text-xs text-destructive">{error}</div>
            ) : null}
          </div>
          <button
            type="button"
            className="rounded p-1 text-muted-foreground hover:bg-secondary"
            onClick={() => onFile(null)}
            disabled={disabled}
            aria-label="Remove file"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border p-6 text-center hover:bg-secondary/50">
          {icon}
          <span className="text-xs text-muted-foreground">{hint}</span>
          <span className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
            Choose file
          </span>
          <input
            type="file"
            accept={accept}
            className="sr-only"
            disabled={disabled}
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          />
        </label>
      )}
    </div>
  );
}
