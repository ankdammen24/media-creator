import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent, type ChangeEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Upload as UploadIcon,
  X,
  CheckCircle2,
  AlertCircle,
  Mic,
  User as UserIcon,
  Image as ImageIcon,
  Sparkles,
} from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { ShowPicker } from "@/components/ShowPicker";
import { nextEpisodeNumber, EPISODE_TYPE_LABELS, type PodcastEpisodeType } from "@/lib/podcast-helpers";
import { useServerFn } from "@tanstack/react-start";
import { autoFetchArtistArtwork } from "@/lib/artwork.functions";
import { AiArtworkDialog } from "@/components/AiArtworkDialog";

type ArtistProfile = {
  id: string;
  name: string;
  bio: string | null;
};

export const Route = createFileRoute("/upload")({
  head: () => ({
    meta: [
      { title: "Upload podcast — Media Rosenqvist Catalog" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <ProtectedRoute>
      <UploadPage />
    </ProtectedRoute>
  ),
});

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

function parseList(s: string): string[] {
  return s
    .split(",")
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
}

function UploadPage() {
  const { user } = useAuth();
  const { t } = useTranslation();

  // Profiles
  const [profiles, setProfiles] = useState<ArtistProfile[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [profilesError, setProfilesError] = useState<string | null>(null);
  // Multi-select: ordered list of artist ids; index 0 = primary
  const [profileIds, setProfileIds] = useState<string[]>([]);
  const [creatingProfile, setCreatingProfile] = useState(false);
  const [newProfileName, setNewProfileName] = useState("");
  const [newProfileBio, setNewProfileBio] = useState("");
  const [createBusy, setCreateBusy] = useState(false);
  const autoFetchArtistImage = useServerFn(autoFetchArtistArtwork);

  // Episode
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [audio, setAudio] = useState<File | null>(null);
  const [artwork, setArtwork] = useState<File | null>(null);
  const [showId, setShowId] = useState<string>("");
  const [seasonInput, setSeasonInput] = useState<string>("");
  const [episodeInput, setEpisodeInput] = useState<string>("");
  const [episodeType, setEpisodeType] = useState<PodcastEpisodeType>("full");
  const [hostsInput, setHostsInput] = useState<string>("");
  const [guestsInput, setGuestsInput] = useState<string>("");
  const [publishDate, setPublishDate] = useState<string>("");
  const [explicit, setExplicit] = useState(false);

  // Reset show when artist changes
  useEffect(() => {
    setShowId("");
    setEpisodeInput("");
  }, [profileIds[0]]);

  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [phase, setPhase] = useState<"" | "presign" | "audio" | "artwork" | "complete">("");
  const [audioPct, setAudioPct] = useState(0);
  const [artworkPct, setArtworkPct] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [aiOpen, setAiOpen] = useState(false);

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
      if (items.length === 1) setProfileIds([items[0].id]);
      } catch (e) {
        if (on) setProfilesError(e instanceof Error ? e.message : t("uploadEpisode.couldNotLoadProfiles"));
      } finally {
        if (on) setProfilesLoading(false);
      }
    })();
    return () => {
      on = false;
    };
  }, [user]);

  const audioError = (() => {
    if (!audio) return null;
    if (!AUDIO_EXTS.includes(extOf(audio.name)))
      return t("uploadEpisode.audioUnsupported", { formats: AUDIO_EXTS.join(", ").toUpperCase() });
    if (audio.size > MAX_AUDIO_BYTES)
      return t("uploadEpisode.audioTooLarge", { size: formatBytes(audio.size), max: formatBytes(MAX_AUDIO_BYTES) });
    return null;
  })();

  const artworkError = (() => {
    if (!artwork) return null;
    if (!IMAGE_EXTS.includes(extOf(artwork.name)))
      return t("uploadEpisode.artworkUnsupported", { formats: IMAGE_EXTS.join(", ").toUpperCase() });
    if (artwork.size > MAX_IMAGE_BYTES)
      return t("uploadEpisode.artworkTooLarge", { size: formatBytes(artwork.size), max: formatBytes(MAX_IMAGE_BYTES) });
    return null;
  })();

  const canSubmit =
    status !== "submitting" &&
    profileIds.length > 0 &&
    title.trim().length > 0 &&
    !!audio &&
    !audioError &&
    !!artwork &&
    !artworkError &&
    !!showId;

  function resetForm() {
    setTitle("");
    setDescription("");
    setAudio(null);
    setArtwork(null);
    setShowId("");
    setSeasonInput("");
    setEpisodeInput("");
    setEpisodeType("full");
    setHostsInput("");
    setGuestsInput("");
    setPublishDate("");
    setExplicit(false);
    setStatus("idle");
    setPhase("");
    setAudioPct(0);
    setArtworkPct(0);
    setError(null);
  }

  async function createProfile(e: FormEvent) {
    e.preventDefault();
    if (!newProfileName.trim() || !user) return;
    setCreateBusy(true);
    setProfilesError(null);
    try {
      const { data, error } = await supabase
        .from("artist_profiles")
        .insert({
          user_id: user.id,
          name: newProfileName.trim(),
          bio: newProfileBio.trim() || null,
        })
        .select("id, name, bio")
        .single();
      if (error) throw error;
      const p = data as ArtistProfile;
      setProfiles((cur) => [...cur, p]);
      setProfileIds((cur) => (cur.includes(p.id) ? cur : [...cur, p.id]));
      setNewProfileName("");
      setNewProfileBio("");
      setCreatingProfile(false);
      // Fire-and-forget: try to grab a default avatar from iTunes.
      autoFetchArtistImage({ data: { artistId: p.id } }).catch((e) =>
        console.warn("autoFetchArtistArtwork failed", e),
      );
    } catch (err) {
      setProfilesError(err instanceof Error ? err.message : t("uploadEpisode.couldNotCreateProfile"));
    } finally {
      setCreateBusy(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit || !audio || !artwork || !user) return;

    setStatus("submitting");
    setError(null);
    setAudioPct(0);
    setArtworkPct(0);

    try {
      const uid = user.id;
      const stamp = Date.now();
      const audioPath = `${uid}/${stamp}-${sanitize(audio.name)}`;
      const artworkPath = `${uid}/${stamp}-${sanitize(artwork.name)}`;

      setPhase("audio");
      const audioUp = await supabase.storage.from("audio").upload(audioPath, audio, {
        cacheControl: "3600",
        upsert: false,
        contentType: audio.type || undefined,
      });
      if (audioUp.error) throw audioUp.error;
      setAudioPct(100);

      setPhase("artwork");
      const artUp = await supabase.storage.from("artwork").upload(artworkPath, artwork, {
        cacheControl: "3600",
        upsert: false,
        contentType: artwork.type || undefined,
      });
      if (artUp.error) {
        // best effort cleanup of audio
        await supabase.storage.from("audio").remove([audioPath]);
        throw artUp.error;
      }
      setArtworkPct(100);

      setPhase("complete");
      const primaryId = profileIds[0];
      const parsedEpisode = parseInt(episodeInput, 10);
      const resolvedEpisode =
        Number.isFinite(parsedEpisode) && parsedEpisode > 0
          ? parsedEpisode
          : await nextEpisodeNumber(showId);
      const parsedSeason = parseInt(seasonInput, 10);
      const resolvedSeason = Number.isFinite(parsedSeason) && parsedSeason > 0 ? parsedSeason : null;

      const { data: inserted, error: insertErr } = await supabase
        .from("submissions")
        .insert({
          user_id: uid,
          artist_profile_id: primaryId,
          media_type: "podcast",
          title: title.trim(),
          description: description.trim() || null,
          audio_path: audioPath,
          artwork_path: artworkPath,
          status: "pending_review",
          album_id: showId,
          episode_number: resolvedEpisode,
          season_number: resolvedSeason,
          episode_type: episodeType,
          hosts: parseList(hostsInput),
          guests: parseList(guestsInput),
          scheduled_publish_at: publishDate ? new Date(publishDate).toISOString() : null,
          explicit,
        } as never)
        .select("id")
        .single();
      if (insertErr) {
        await supabase.storage.from("audio").remove([audioPath]);
        await supabase.storage.from("artwork").remove([artworkPath]);
        throw insertErr;
      }

      // Insert join rows for all selected artists
      if (inserted) {
        const rows = profileIds.map((aid, idx) => ({
          submission_id: inserted.id,
          artist_profile_id: aid,
          is_primary: idx === 0,
          position: idx,
        }));
        const { error: joinErr } = await supabase.from("submission_artists").insert(rows);
        if (joinErr) {
          // Non-fatal: submission already exists with primary artist; surface a warning
          console.warn("Could not link additional artists:", joinErr.message);
        }
      }

      setStatus("success");
    } catch (err) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : t("uploadEpisode.somethingWrong");
      setError(msg);
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-8 text-center shadow-lg">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h1 className="mb-2 text-2xl font-semibold">{t("uploadEpisode.success.title")}</h1>
          <p className="mb-2 text-sm text-muted-foreground">
            {t("uploadEpisode.success.body")}
          </p>
          <p className="mb-6 text-xs text-amber-700 dark:text-amber-300">
            {t("uploadEpisode.success.demo")}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              {t("uploadEpisode.success.submitAnother")}
            </button>
            <Link
              to="/catalog"
              className="inline-flex items-center justify-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              {t("uploadEpisode.success.backToCatalog")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const primaryProfile = profiles.find((p) => p.id === profileIds[0]);
  const selectedProfiles = profileIds
    .map((id) => profiles.find((p) => p.id === id))
    .filter((p): p is ArtistProfile => !!p);

  function toggleProfile(id: string) {
    setProfileIds((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    );
  }
  function makePrimary(id: string) {
    setProfileIds((cur) => [id, ...cur.filter((x) => x !== id)]);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="mb-6 inline-flex rounded-lg border border-border bg-card p-1">
        <Link
          to="/upload"
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
        >
          {t("uploadEpisode.tabs.single")}
        </Link>
        <Link
          to="/upload-batch"
          className="rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          {t("uploadEpisode.tabs.batch")}
        </Link>
      </div>
      <div className="mb-8">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-border bg-secondary/40 px-3 py-1 text-xs text-muted-foreground">
          <Mic className="h-3.5 w-3.5 text-primary" />
          {t("uploadEpisode.welcome", { name: user?.name ? t("uploadEpisode.welcomeName", { name: user.name }) : "" })}
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">{t("uploadEpisode.pageTitle")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("uploadEpisode.intro")}
        </p>
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            <span className="font-semibold">{t("uploadEpisode.demoLabel")}</span> {t("uploadEpisode.demoBody")}
          </p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        {/* Step 1: profile */}
        <Step n={1} title={t("uploadEpisode.step1")} icon={<UserIcon className="h-4 w-4" />}>
          {profilesLoading ? (
            <p className="text-sm text-muted-foreground">{t("uploadEpisode.loadingProfiles")}</p>
          ) : (
            <>
              {profiles.length > 0 && !creatingProfile && (
                <div className="grid gap-2 sm:grid-cols-2">
                  {profiles.map((p) => {
                    const idx = profileIds.indexOf(p.id);
                    const active = idx >= 0;
                    const isPrimary = idx === 0;
                    return (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => toggleProfile(p.id)}
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
                          {active && (
                            <span
                              role="button"
                              tabIndex={0}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!isPrimary) makePrimary(p.id);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.stopPropagation();
                                  if (!isPrimary) makePrimary(p.id);
                                }
                              }}
                              className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${
                                isPrimary
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                              }`}
                            >
                              {isPrimary ? "Primary" : "Sätt som primär"}
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
              {profileIds.length > 1 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {t("uploadEpisode.multiProfileHint")}
                </p>
              )}

              {profiles.length === 0 && !creatingProfile && (
                <p className="text-sm text-muted-foreground">
                  {t("uploadEpisode.noProfiles")}
                </p>
              )}

              {!creatingProfile ? (
                <button
                  type="button"
                  onClick={() => setCreatingProfile(true)}
                  className="mt-3 inline-flex items-center gap-1 rounded-md border border-dashed border-border bg-background px-3 py-2 text-sm hover:bg-accent/40"
                >
                  {t("uploadEpisode.newProfile")}
                </button>
              ) : (
                <div className="mt-3 rounded-lg border border-border bg-background p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-medium">{t("uploadEpisode.createProfile")}</h3>
                    <button
                      type="button"
                      onClick={() => setCreatingProfile(false)}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label={t("uploadEpisode.cancel")}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium">{t("uploadEpisode.hostName")}</label>
                      <input
                        type="text"
                        value={newProfileName}
                        onChange={(e) => setNewProfileName(e.target.value)}
                        maxLength={100}
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                        placeholder={t("uploadEpisode.hostNamePlaceholder")}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium">{t("uploadEpisode.shortBio")}</label>
                      <textarea
                        value={newProfileBio}
                        onChange={(e) => setNewProfileBio(e.target.value)}
                        maxLength={500}
                        rows={2}
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                      />
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={createProfile}
                        disabled={!newProfileName.trim() || createBusy}
                        className="inline-flex items-center justify-center rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {createBusy ? t("uploadEpisode.creating") : t("uploadEpisode.createProfileBtn")}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {profilesError && (
                <p className="mt-2 text-xs text-destructive">{profilesError}</p>
              )}
            </>
          )}
        </Step>

        {/* Step 2: episode details */}
        <Step n={2} title={t("uploadEpisode.step2")} icon={<Mic className="h-4 w-4" />}>
          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-background/40 p-3">
              <label className="mb-2 block text-sm font-medium">
                {t("uploadEpisode.show")} <span className="text-destructive">*</span>
              </label>
              <ShowPicker
                artistId={profileIds[0] ?? null}
                value={showId}
                onChange={setShowId}
                disabled={status === "submitting"}
              />
            </div>

            <div>
              <label htmlFor="title" className="mb-1 block text-sm font-medium">
                {t("uploadEpisode.episodeTitle")} <span className="text-destructive">*</span>
              </label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                disabled={status === "submitting"}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
              />
            </div>

            <div>
              <label htmlFor="desc" className="mb-1 block text-sm font-medium">
                {t("uploadEpisode.showNotes")} <span className="text-xs font-normal text-muted-foreground">{t("uploadEpisode.optional")}</span>
              </label>
              <textarea
                id="desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={2000}
                rows={3}
                disabled={status === "submitting"}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium">
                  {t("uploadEpisode.season")} <span className="font-normal text-muted-foreground">{t("uploadEpisode.optional")}</span>
                </label>
                <input
                  type="number"
                  min={1}
                  value={seasonInput}
                  onChange={(e) => setSeasonInput(e.target.value)}
                  placeholder="—"
                  disabled={status === "submitting"}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">
                  {t("uploadEpisode.episodeNum")} <span className="font-normal text-muted-foreground">{t("uploadEpisode.autoIfBlank")}</span>
                </label>
                <input
                  type="number"
                  min={1}
                  value={episodeInput}
                  onChange={(e) => setEpisodeInput(e.target.value)}
                  placeholder={t("uploadEpisode.auto")}
                  disabled={status === "submitting"}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">{t("uploadEpisode.episodeType")}</label>
                <select
                  value={episodeType}
                  onChange={(e) => setEpisodeType(e.target.value as PodcastEpisodeType)}
                  disabled={status === "submitting"}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                >
                  {(Object.keys(EPISODE_TYPE_LABELS) as PodcastEpisodeType[]).map((et) => (
                    <option key={et} value={et}>
                      {t(`podcastEpisodeType.${et}`)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium">
                  {t("uploadEpisode.hosts")} <span className="font-normal text-muted-foreground">{t("uploadEpisode.commaSeparated")}</span>
                </label>
                <input
                  type="text"
                  value={hostsInput}
                  onChange={(e) => setHostsInput(e.target.value)}
                  placeholder={t("uploadEpisode.hostsPlaceholder")}
                  disabled={status === "submitting"}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">
                  {t("uploadEpisode.guests")} <span className="font-normal text-muted-foreground">{t("uploadEpisode.commaSeparated")}</span>
                </label>
                <input
                  type="text"
                  value={guestsInput}
                  onChange={(e) => setGuestsInput(e.target.value)}
                  placeholder={t("uploadEpisode.guestsPlaceholder")}
                  disabled={status === "submitting"}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium">
                  {t("uploadEpisode.publishDate")} <span className="font-normal text-muted-foreground">{t("uploadEpisode.optional")}</span>
                </label>
                <input
                  type="date"
                  value={publishDate}
                  onChange={(e) => setPublishDate(e.target.value)}
                  disabled={status === "submitting"}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="flex items-end">
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={explicit}
                    onChange={(e) => setExplicit(e.target.checked)}
                    disabled={status === "submitting"}
                    className="h-4 w-4 rounded border-border"
                  />
                  {t("uploadEpisode.explicit")}
                </label>
              </div>
            </div>
          </div>
        </Step>

        {/* Step 3: media */}
        <Step n={3} title={t("uploadEpisode.step3")} icon={<UploadIcon className="h-4 w-4" />}>
          <div className="grid gap-4 md:grid-cols-2">
            <FilePicker
              id="audio"
              label={t("uploadEpisode.audioFile")}
              required
              accept={AUDIO_ACCEPT}
              file={audio}
              error={audioError}
              disabled={status === "submitting"}
              icon={<Mic className="h-5 w-5 text-muted-foreground" />}
              hint={t("uploadEpisode.audioHint", { max: formatBytes(MAX_AUDIO_BYTES) })}
              onChange={(f) => setAudio(f)}
            />
            <FilePicker
              id="artwork"
              label={t("uploadEpisode.artwork")}
              required
              accept={IMAGE_ACCEPT}
              file={artwork}
              error={artworkError}
              disabled={status === "submitting"}
              icon={<ImageIcon className="h-5 w-5 text-muted-foreground" />}
              hint={t("uploadEpisode.artworkHint", { max: formatBytes(MAX_IMAGE_BYTES) })}
              onChange={(f) => setArtwork(f)}
              preview
            />
          </div>
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setAiOpen(true)}
              disabled={status === "submitting"}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:bg-accent disabled:opacity-50"
            >
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              {t("uploadEpisode.aiArtworkButton")}
            </button>
          </div>

          {status === "submitting" && (
            <div className="mt-5 space-y-3">
              <ProgressRow label={t("uploadEpisode.uploadProgress.audio")} pct={audioPct} active={phase === "audio"} done={phase === "artwork" || phase === "complete"} />
              <ProgressRow label={t("uploadEpisode.uploadProgress.artwork")} pct={artworkPct} active={phase === "artwork"} done={phase === "complete"} />
              {phase === "presign" && (
                <p className="text-xs text-muted-foreground">{t("uploadEpisode.preparing")}</p>
              )}
              {phase === "complete" && (
                <p className="text-xs text-muted-foreground">{t("uploadEpisode.finalizing")}</p>
              )}
            </div>
          )}
        </Step>

        {/* Step 4: submit */}
        <Step n={4} title={t("uploadEpisode.step4")} icon={<CheckCircle2 className="h-4 w-4" />}>
          {error && (
            <div className="mb-3 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{error}</p>
            </div>
          )}
          <p className="mb-3 text-xs text-muted-foreground">
            {t("uploadEpisode.submittingAs")}{" "}
            <strong className="text-foreground">{primaryProfile?.name ?? "—"}</strong>
            {selectedProfiles.length > 1 && (
              <>
                {" "}{t("uploadEpisode.with")}{" "}
                <strong className="text-foreground">
                  {selectedProfiles.slice(1).map((p) => p.name).join(", ")}
                </strong>
              </>
            )}
            {t("uploadEpisode.tailReview")}
          </p>
          <button
            type="submit"
            disabled={!canSubmit}
            className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {status === "submitting" ? t("uploadEpisode.submittingBtn") : t("uploadEpisode.submitBtn")}
          </button>
        </Step>
      </form>
      <AiArtworkDialog
        open={aiOpen}
        aspect="1:1"
        title={t("uploadEpisode.aiArtworkDialog")}
        filenameHint={`episode-${title || "untitled"}`}
        defaultPrompt={t("uploadEpisode.aiArtworkPrompt", {
          title: title || t("uploadEpisode.fallbackTitle"),
          artistPart: primaryProfile ? t("uploadEpisode.ofArtist", { name: primaryProfile.name }) : "",
        })}
        onClose={() => setAiOpen(false)}
        onGenerated={(file) => setArtwork(file)}
      />
    </div>
  );
}

function Step({
  n,
  title,
  icon,
  children,
}: {
  n: number;
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <header className="mb-4 flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
          {n}
        </span>
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <span className="text-muted-foreground">{icon}</span>
          {title}
        </h2>
      </header>
      {children}
    </section>
  );
}

function FilePicker({
  id,
  label,
  required,
  accept,
  file,
  error,
  disabled,
  icon,
  hint,
  onChange,
  preview,
}: {
  id: string;
  label: string;
  required?: boolean;
  accept: string;
  file: File | null;
  error: string | null;
  disabled?: boolean;
  icon: ReactNode;
  hint: string;
  onChange: (f: File | null) => void;
  preview?: boolean;
}) {
  const { t } = useTranslation();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!preview || !file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file, preview]);

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    onChange(e.target.files?.[0] ?? null);
  }

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      {!file ? (
        <label
          htmlFor={id}
          className="flex h-32 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-border bg-background px-4 py-4 text-center hover:bg-accent/40"
        >
          {icon}
          <span className="mt-2 text-sm font-medium">{t("uploadEpisode.chooseLabel", { label: label.toLowerCase() })}</span>
          <span className="mt-1 text-xs text-muted-foreground">{hint}</span>
          <input
            id={id}
            type="file"
            accept={accept}
            onChange={onFileChange}
            className="sr-only"
            disabled={disabled}
          />
        </label>
      ) : (
        <div className="flex items-center gap-3 rounded-md border border-border bg-background p-3">
          {preview && previewUrl ? (
            <img src={previewUrl} alt="Artwork preview" className="h-14 w-14 rounded object-cover" />
          ) : (
            <span className="flex h-10 w-10 items-center justify-center rounded bg-secondary">{icon}</span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{file.name}</p>
            <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
          </div>
          <button
            type="button"
            onClick={() => onChange(null)}
            disabled={disabled}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border hover:bg-accent disabled:opacity-60"
            aria-label={t("uploadEpisode.removeAria", { label })}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

function ProgressRow({
  label,
  pct,
  active,
  done,
}: {
  label: string;
  pct: number;
  active: boolean;
  done: boolean;
}) {
  const { t } = useTranslation();
  const shown = done ? 100 : pct;
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-muted-foreground">
        <span>
          {label} {done ? t("uploadEpisode.uploadProgress.uploaded") : active ? t("uploadEpisode.uploadProgress.uploading") : ""}
        </span>
        <span>{shown}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full transition-all ${done ? "bg-emerald-500" : "bg-primary"}`}
          style={{ width: `${shown}%` }}
        />
      </div>
    </div>
  );
}
