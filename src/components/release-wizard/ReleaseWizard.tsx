import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type ReactNode,
} from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Disc3,
  FileMusic,
  Globe,
  Image as ImageIcon,
  Loader2,
  Music2,
  Save,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload as UploadIcon,
  X,
  Info,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AiArtworkDialog } from "@/components/AiArtworkDialog";
import { PLATFORMS, type PlatformCode } from "@/lib/release-platforms";
import { ReleaseStatusBadge, type ReleaseStatus } from "./ReleaseStatusBadge";

// ============================================================
// Constants
// ============================================================
const AUDIO_EXTS = ["wav", "flac", "aiff", "aif", "mp3", "m4a"];
const AUDIO_ACCEPT =
  ".wav,.flac,.aiff,.aif,.mp3,.m4a,audio/wav,audio/flac,audio/aiff,audio/mpeg,audio/mp4";
const IMAGE_EXTS = ["jpg", "jpeg", "png", "webp"];
const IMAGE_ACCEPT = ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp";
const MAX_AUDIO_BYTES = 500 * 1024 * 1024;
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

const GENRES = [
  "Pop", "Rock", "Hip-Hop", "R&B", "Electronic", "House", "Techno",
  "Indie", "Folk", "Country", "Jazz", "Classical", "Soundtrack",
  "Ambient", "Metal", "Punk", "Reggae", "Latin", "World", "Other",
];

const LANGUAGES = [
  { code: "sv", label: "Svenska" },
  { code: "en", label: "English" },
  { code: "no", label: "Norsk" },
  { code: "da", label: "Dansk" },
  { code: "fi", label: "Suomi" },
  { code: "de", label: "Deutsch" },
  { code: "fr", label: "Français" },
  { code: "es", label: "Español" },
  { code: "instrumental", label: "Instrumental" },
  { code: "other", label: "Annat" },
];

const ISRC_RE = /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/;

// ============================================================
// Helpers
// ============================================================
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
function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
function formatDuration(s: number | null) {
  if (!s || !isFinite(s)) return "—";
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, "0")}`;
}
function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ============================================================
// Types & State
// ============================================================
type ArtistProfile = { id: string; name: string };
type TrackStatus = "queued" | "uploading" | "ready" | "error";

type TrackDraft = {
  id: string;
  file: File;
  audioPath: string | null;
  uploadPct: number;
  status: TrackStatus;
  errorMsg: string | null;
  // metadata
  title: string;
  version: string;
  featuredArtists: string; // comma-separated
  isrc: string;
  explicit: boolean;
  instrumental: boolean;
  aiGenerated: boolean;
  previewStart: number;
  songwriters: string; // comma-separated
  producers: string; // comma-separated
  atmosAvailable: boolean;
  atmosFile: File | null;
  durationSeconds: number | null;
  loudnessLufs: number | null;
};

type ReleaseState = {
  // step 1
  title: string;
  artistProfileId: string;
  label: string;
  releaseDate: string;
  primaryGenre: string;
  secondaryGenre: string;
  language: string;
  previouslyReleased: boolean;
  cover: File | null;
  coverError: string | null;
  // step 2
  platforms: PlatformCode[];
  // step 3
  tracks: TrackDraft[];
  // step 4
  rights: {
    owns: boolean;
    permission: boolean;
    policies: boolean;
    noManipulation: boolean;
    terms: boolean;
  };
  // meta
  albumId: string | null;
  status: ReleaseStatus;
  dirty: boolean;
  savedAt: Date | null;
};

function initialState(): ReleaseState {
  return {
    title: "",
    artistProfileId: "",
    label: "Crystal Pier Records",
    releaseDate: "",
    primaryGenre: "",
    secondaryGenre: "",
    language: "sv",
    previouslyReleased: false,
    cover: null,
    coverError: null,
    platforms: ["spotify", "apple_music", "youtube_music"],
    tracks: [],
    rights: {
      owns: false,
      permission: false,
      policies: false,
      noManipulation: false,
      terms: false,
    },
    albumId: null,
    status: "draft",
    dirty: false,
    savedAt: null,
  };
}

type Action =
  | { type: "patch"; patch: Partial<ReleaseState> }
  | { type: "togglePlatform"; code: PlatformCode }
  | { type: "addTracks"; tracks: TrackDraft[] }
  | { type: "updateTrack"; id: string; patch: Partial<TrackDraft> }
  | { type: "removeTrack"; id: string }
  | { type: "patchRights"; patch: Partial<ReleaseState["rights"]> }
  | { type: "markSaved"; albumId: string; status?: ReleaseStatus }
  | { type: "markDirty" };

function reducer(state: ReleaseState, action: Action): ReleaseState {
  switch (action.type) {
    case "patch":
      return { ...state, ...action.patch, dirty: true };
    case "togglePlatform": {
      const has = state.platforms.includes(action.code);
      return {
        ...state,
        platforms: has
          ? state.platforms.filter((c) => c !== action.code)
          : [...state.platforms, action.code],
        dirty: true,
      };
    }
    case "addTracks":
      return { ...state, tracks: [...state.tracks, ...action.tracks], dirty: true };
    case "updateTrack":
      return {
        ...state,
        tracks: state.tracks.map((t) =>
          t.id === action.id ? { ...t, ...action.patch } : t,
        ),
        // Only flag dirty when metadata changes, not upload progress
        dirty:
          action.patch.uploadPct !== undefined || action.patch.status !== undefined
            ? state.dirty
            : true,
      };
    case "removeTrack":
      return {
        ...state,
        tracks: state.tracks.filter((t) => t.id !== action.id),
        dirty: true,
      };
    case "patchRights":
      return {
        ...state,
        rights: { ...state.rights, ...action.patch },
        dirty: true,
      };
    case "markSaved":
      return {
        ...state,
        albumId: action.albumId,
        status: action.status ?? state.status,
        dirty: false,
        savedAt: new Date(),
      };
    case "markDirty":
      return { ...state, dirty: true };
  }
}

// ============================================================
// Steps definition
// ============================================================
const STEPS = [
  { id: 1, label: "Tracks", icon: FileMusic },
  { id: 2, label: "Release Details", icon: Disc3 },
  { id: 3, label: "Platforms", icon: Globe },
  { id: 4, label: "Rights", icon: ShieldCheck },
  { id: 5, label: "Review", icon: Check },
] as const;

type StepId = (typeof STEPS)[number]["id"];

// ============================================================
// Main component
// ============================================================
export function ReleaseWizard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const [step, setStep] = useState<StepId>(1);
  const [profiles, setProfiles] = useState<ArtistProfile[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittedOk, setSubmittedOk] = useState(false);

  // Load artist profiles
  useEffect(() => {
    let on = true;
    (async () => {
      if (!user) return;
      try {
        const { data, error } = await supabase
          .from("artist_profiles")
          .select("id, name")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true });
        if (!on) return;
        if (error) throw error;
        const items = (data ?? []) as ArtistProfile[];
        setProfiles(items);
        if (items.length === 1) {
          dispatch({ type: "patch", patch: { artistProfileId: items[0].id } });
        }
      } finally {
        if (on) setProfilesLoading(false);
      }
    })();
    return () => {
      on = false;
    };
  }, [user]);

  // Validation per step
  const errors = useMemo(() => validate(state), [state]);
  const canGoNext = errors[step].length === 0;

  // Save draft (manual + autosave)
  const saveDraft = useCallback(
    async (silent = false): Promise<string | null> => {
      if (!user || !state.artistProfileId || !state.title.trim()) return null;
      if (saving) return state.albumId;
      setSaving(true);
      setSaveError(null);
      try {
        // Upload cover if it's a new File and we haven't yet
        let coverPath: string | null = null;
        if (state.cover) {
          const stamp = Date.now();
          coverPath = `${user.id}/release-${stamp}-${sanitize(state.cover.name)}`;
          const up = await supabase.storage
            .from("artwork")
            .upload(coverPath, state.cover, {
              cacheControl: "3600",
              upsert: false,
              contentType: state.cover.type || undefined,
            });
          if (up.error) throw up.error;
        }

        const payload = {
          user_id: user.id,
          artist_profile_id: state.artistProfileId,
          title: state.title.trim(),
          label: state.label.trim() || null,
          language: state.language || null,
          genre: state.primaryGenre || null,
          secondary_genre: state.secondaryGenre || null,
          previously_released: state.previouslyReleased,
          release_date: state.releaseDate || null,
          distribution_platforms: state.platforms,
          album_type: "album" as const,
          status: "draft" as const,
          ...(coverPath ? { artwork_path: coverPath } : {}),
        };

        let albumId = state.albumId;
        if (albumId) {
          const { error } = await supabase
            .from("albums")
            .update(payload)
            .eq("id", albumId);
          if (error) throw error;
        } else {
          const { data, error } = await supabase
            .from("albums")
            .insert(payload)
            .select("id")
            .single();
          if (error) throw error;
          albumId = data.id;
        }

        // Clear local cover File so we don't re-upload on next save
        if (coverPath) {
          dispatch({ type: "patch", patch: { cover: null } });
        }
        dispatch({ type: "markSaved", albumId: albumId!, status: "draft" });
        return albumId;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Save failed";
        if (!silent) setSaveError(msg);
        return null;
      } finally {
        setSaving(false);
      }
    },
    [user, state, saving],
  );

  // Autosave: debounce 8s after dirty changes, only if title + artist set
  const dirtyRef = useRef(state.dirty);
  dirtyRef.current = state.dirty;
  useEffect(() => {
    if (!state.dirty || !state.title.trim() || !state.artistProfileId) return;
    const t = setTimeout(() => {
      if (dirtyRef.current) void saveDraft(true);
    }, 8000);
    return () => clearTimeout(t);
  }, [state.dirty, state.title, state.artistProfileId, saveDraft]);

  // Submit for review
  async function submitRelease() {
    if (!user) return;
    if (errors[1].length || errors[2].length || errors[3].length || errors[4].length) {
      return;
    }
    setSubmitting(true);
    setSaveError(null);
    try {
      // Ensure draft is saved (gives us albumId + cover_path)
      const albumId = await saveDraft(true);
      if (!albumId) throw new Error("Could not save release");

      // Insert submissions (tracks) for any not yet submitted
      // We check existing submissions for this album to avoid dupes
      const { data: existing } = await supabase
        .from("submissions")
        .select("id, track_number")
        .eq("album_id", albumId);
      const existingNumbers = new Set((existing ?? []).map((r) => r.track_number));

      // Fetch album artwork to reuse for each track
      const { data: alb } = await supabase
        .from("albums")
        .select("artwork_path")
        .eq("id", albumId)
        .single();
      const albumArt = alb?.artwork_path;
      if (!albumArt) throw new Error("Saknar omslag — ladda upp cover först.");

      let trackNo =
        Math.max(0, ...Array.from(existingNumbers).filter((n): n is number => !!n)) + 1;

      for (const t of state.tracks) {
        if (!t.audioPath) continue;

        // Optional Atmos upload
        let atmosPath: string | null = null;
        if (t.atmosFile) {
          const stamp = Date.now();
          atmosPath = `${user.id}/atmos-${stamp}-${sanitize(t.atmosFile.name)}`;
          const up = await supabase.storage
            .from("audio")
            .upload(atmosPath, t.atmosFile, {
              cacheControl: "3600",
              upsert: false,
              contentType: t.atmosFile.type || undefined,
            });
          if (up.error) throw up.error;
        }

        const { data: inserted, error } = await supabase
          .from("submissions")
          .insert({
            user_id: user.id,
            artist_profile_id: state.artistProfileId,
            album_id: albumId,
            track_number: trackNo++,
            media_type: "music",
            title: t.title.trim() || baseName(t.file.name),
            version: t.version.trim() || null,
            audio_path: t.audioPath,
            artwork_path: albumArt,
            status: "pending_review" as const,
            featured_artists: splitList(t.featuredArtists),
            isrc: t.isrc.trim().toUpperCase() || null,
            explicit: t.explicit,
            instrumental: t.instrumental,
            ai_generated: t.aiGenerated,
            preview_start_seconds: Number.isFinite(t.previewStart)
              ? Math.max(0, Math.floor(t.previewStart))
              : null,
            songwriters: splitList(t.songwriters),
            producers: splitList(t.producers),
            dolby_atmos_available: t.atmosAvailable,
            atmos_audio_path: atmosPath,
            duration_seconds: t.durationSeconds,
          })
          .select("id")
          .single();
        if (error) throw error;
        if (inserted) {
          await supabase.from("submission_artists").insert({
            submission_id: inserted.id,
            artist_profile_id: state.artistProfileId,
            is_primary: true,
            position: 0,
          });
        }
      }

      // Mark release as under_review
      const { error: updErr } = await supabase
        .from("albums")
        .update({
          status: "under_review",
          submitted_at: new Date().toISOString(),
          rights_accepted_at: new Date().toISOString(),
        })
        .eq("id", albumId);
      if (updErr) throw updErr;

      dispatch({ type: "markSaved", albumId, status: "under_review" });
      setSubmittedOk(true);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (submittedOk) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary/30 to-accent/30">
          <Check className="h-10 w-10 text-primary" />
        </div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Release submitted for review
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
          Releasen har sparats i Media Rosenqvist Catalog och skickats till Radio
          Uppsala för granskning. Du kan följa statusen under "Mine".
        </p>
        <p className="mx-auto mt-3 max-w-md text-xs text-amber-700 dark:text-amber-300">
          Obs: distribution till Spotify, Apple Music och andra streamingtjänster
          är inte aktiv — detta är en demo-inskickning.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <button
            onClick={() => navigate({ to: "/my-submissions" })}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            See my releases
          </button>
          <button
            onClick={() => navigate({ to: "/" })}
            className="rounded-md border border-border px-4 py-2 text-sm hover:bg-secondary"
          >
            Back home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[calc(100vh-3.5rem)]">
      {/* Cinematic background accents */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-32 top-0 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute right-0 top-40 h-80 w-80 rounded-full bg-accent/10 blur-3xl" />
      </div>

      <div className="mx-auto max-w-7xl px-4 pb-32 pt-8 sm:px-6">
        {/* Header */}
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Crystal Pier Records · New Release
            </p>
            <h1 className="font-display mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
              {state.title || "Untitled Release"}
            </h1>
          </div>
          <ReleaseStatusBadge status={state.status} size="md" />
        </div>

        <DemoNotice className="mb-8" />

        <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
          {/* Sidebar (desktop) */}
          <aside className="hidden lg:block">
            <div className="sticky top-20">
              <StepSidebar
                step={step}
                errors={errors}
                onSelect={(id) => setStep(id)}
              />
            </div>
          </aside>

          {/* Mobile progress */}
          <div className="lg:hidden">
            <MobileProgress step={step} />
          </div>

          {/* Step content */}
          <div className="min-w-0">
            <div
              key={step}
              className="animate-in fade-in slide-in-from-bottom-2 duration-300"
            >
              {step === 1 && (
                <StepTracks state={state} dispatch={dispatch} />
              )}
              {step === 2 && (
                <StepReleaseDetails
                  state={state}
                  errors={errors[2]}
                  profiles={profiles}
                  profilesLoading={profilesLoading}
                  dispatch={dispatch}
                  onArtistCreated={(p) => {
                    setProfiles((cur) => (cur.some((x) => x.id === p.id) ? cur : [...cur, p]));
                    dispatch({ type: "patch", patch: { artistProfileId: p.id } });
                  }}
                />
              )}
              {step === 3 && (
                <StepPlatforms state={state} dispatch={dispatch} />
              )}
              {step === 4 && (
                <StepRights state={state} dispatch={dispatch} />
              )}
              {step === 5 && (
                <StepReview
                  state={state}
                  profiles={profiles}
                  errors={errors}
                  onJump={setStep}
                />
              )}
            </div>

            {/* Nav */}
            <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6">
              <button
                onClick={() => setStep((s) => (Math.max(1, s - 1) as StepId))}
                disabled={step === 1}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-4 py-2 text-sm hover:bg-secondary disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" /> Back
              </button>
              <div className="flex items-center gap-2">
                {step < 5 ? (
                  <button
                    onClick={() => canGoNext && setStep((s) => (Math.min(5, s + 1) as StepId))}
                    disabled={!canGoNext}
                    className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next <ChevronRight className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    onClick={submitRelease}
                    disabled={submitting || hasAnyError(errors)}
                    className="inline-flex items-center gap-1.5 rounded-md bg-gradient-to-r from-primary to-accent px-5 py-2 text-sm font-semibold text-primary-foreground shadow-lg hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    Submit for Review
                  </button>
                )}
              </div>
            </div>

            {/* Step errors */}
            {!canGoNext && errors[step].length > 0 && (
              <ul className="mt-4 space-y-1 text-xs text-destructive">
                {errors[step].map((e, i) => (
                  <li key={i}>• {e}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Floating save bar */}
      <FloatingSaveBar
        dirty={state.dirty}
        saving={saving}
        savedAt={state.savedAt}
        error={saveError}
        canSave={
          !!state.title.trim() &&
          !!state.artistProfileId &&
          !submitting
        }
        onSave={() => void saveDraft(false)}
      />
    </div>
  );
}

// ============================================================
// Validation
// ============================================================
function validate(s: ReleaseState): Record<StepId, string[]> {
  const e: Record<StepId, string[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] };

  // Step 1
  if (!s.title.trim()) e[1].push("Release title is required.");
  if (!s.artistProfileId) e[1].push("Pick an artist profile.");
  if (!s.primaryGenre) e[1].push("Primary genre is required.");
  if (!s.releaseDate) e[1].push("Release date is required.");
  if (!s.cover && !s.albumId) e[1].push("Upload cover artwork.");

  // Step 2
  if (s.platforms.length === 0) e[2].push("Pick at least one platform.");

  // Step 3
  if (s.tracks.length === 0) e[3].push("Add at least one track.");
  const notReady = s.tracks.filter((t) => t.status !== "ready");
  if (notReady.length > 0)
    e[3].push(`${notReady.length} track(s) still uploading or in error.`);
  for (const t of s.tracks) {
    if (!t.title.trim()) e[3].push(`Track "${t.file.name}" needs a title.`);
    if (t.isrc.trim() && !ISRC_RE.test(t.isrc.trim().toUpperCase()))
      e[3].push(`ISRC for "${t.title || t.file.name}" looks invalid.`);
  }

  // Step 4
  const r = s.rights;
  if (!(r.owns && r.permission && r.policies && r.noManipulation && r.terms))
    e[4].push("All rights & ownership boxes must be checked.");

  return e;
}
function hasAnyError(errors: Record<StepId, string[]>) {
  return Object.values(errors).some((arr) => arr.length > 0);
}
function splitList(s: string): string[] {
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

// ============================================================
// Sidebar / Progress
// ============================================================
function StepSidebar({
  step,
  errors,
  onSelect,
}: {
  step: StepId;
  errors: Record<StepId, string[]>;
  onSelect: (id: StepId) => void;
}) {
  return (
    <nav className="rounded-2xl border border-border bg-card/60 p-3 backdrop-blur">
      <ol className="space-y-1">
        {STEPS.map((s) => {
          const Icon = s.icon;
          const active = s.id === step;
          const hasErr = errors[s.id].length > 0;
          return (
            <li key={s.id}>
              <button
                onClick={() => onSelect(s.id)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                  active
                    ? "bg-gradient-to-r from-primary/15 to-accent/10 text-foreground"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                }`}
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full border ${
                    active
                      ? "border-primary/50 bg-primary/15 text-primary"
                      : "border-border bg-background"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="flex-1">
                  <span className="block text-xs uppercase tracking-wider text-muted-foreground">
                    Step {s.id}
                  </span>
                  <span className="block font-medium">{s.label}</span>
                </span>
                {hasErr && !active && (
                  <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function MobileProgress({ step }: { step: StepId }) {
  const pct = (step / STEPS.length) * 100;
  return (
    <div className="mb-6 rounded-xl border border-border bg-card/60 p-4 backdrop-blur">
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          Step {step} of {STEPS.length}
        </span>
        <span className="font-medium">{STEPS[step - 1].label}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ============================================================
// Step 1 — Release Details
// ============================================================
function StepReleaseDetails({
  state,
  errors,
  profiles,
  profilesLoading,
  dispatch,
  onArtistCreated,
}: {
  state: ReleaseState;
  errors: string[];
  profiles: ArtistProfile[];
  profilesLoading: boolean;
  dispatch: React.Dispatch<Action>;
  onArtistCreated: (p: ArtistProfile) => void;
}) {
  const { user } = useAuth();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  async function handleCreate() {
    if (!user || !newName.trim()) return;
    setCreateBusy(true);
    setCreateError(null);
    try {
      const { data, error } = await supabase
        .from("artist_profiles")
        .insert({ user_id: user.id, name: newName.trim() })
        .select("id, name")
        .single();
      if (error) throw error;
      onArtistCreated(data as ArtistProfile);
      setNewName("");
      setCreating(false);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Kunde inte skapa artist");
    } finally {
      setCreateBusy(false);
    }
  }

  return (
    <StepCard
      step={1}
      title="Release Details"
      description="Grunduppgifterna om din release. Allt sparas i Media Rosenqvist Catalog och går att redigera senare."
    >
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Release title" required>
          <input
            type="text"
            value={state.title}
            onChange={(e) =>
              dispatch({ type: "patch", patch: { title: e.target.value } })
            }
            maxLength={200}
            placeholder="Ex. Northern Lights"
            className={inputCls}
          />
        </Field>

        <Field label="Artist" required>
          {profilesLoading ? (
            <div className="rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
              Laddar artister…
            </div>
          ) : (
            <div className="space-y-2">
              {profiles.length > 0 && (
                <select
                  value={state.artistProfileId}
                  onChange={(e) =>
                    dispatch({
                      type: "patch",
                      patch: { artistProfileId: e.target.value },
                    })
                  }
                  className={inputCls}
                >
                  <option value="">Välj artist</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              )}
              {creating ? (
                <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Artistnamn"
                    maxLength={120}
                    className={inputCls}
                    autoFocus
                  />
                  {createError && (
                    <p className="text-xs text-destructive">{createError}</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleCreate}
                      disabled={createBusy || !newName.trim()}
                      className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      {createBusy ? "Skapar…" : "Skapa artist"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCreating(false);
                        setNewName("");
                        setCreateError(null);
                      }}
                      className="inline-flex items-center rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                    >
                      Avbryt
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40"
                >
                  + Skapa ny artist
                </button>
              )}
            </div>
          )}
        </Field>

        <Field label="Label">
          <input
            type="text"
            value={state.label}
            onChange={(e) =>
              dispatch({ type: "patch", patch: { label: e.target.value } })
            }
            maxLength={120}
            className={inputCls}
          />
        </Field>

        <Field label="Release date" required>
          <input
            type="date"
            value={state.releaseDate}
            onChange={(e) =>
              dispatch({ type: "patch", patch: { releaseDate: e.target.value } })
            }
            className={inputCls}
          />
        </Field>

        <Field label="Primary genre" required>
          <select
            value={state.primaryGenre}
            onChange={(e) =>
              dispatch({ type: "patch", patch: { primaryGenre: e.target.value } })
            }
            className={inputCls}
          >
            <option value="">Välj genre</option>
            {GENRES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Secondary genre">
          <select
            value={state.secondaryGenre}
            onChange={(e) =>
              dispatch({
                type: "patch",
                patch: { secondaryGenre: e.target.value },
              })
            }
            className={inputCls}
          >
            <option value="">Ingen</option>
            {GENRES.filter((g) => g !== state.primaryGenre).map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Language">
          <select
            value={state.language}
            onChange={(e) =>
              dispatch({ type: "patch", patch: { language: e.target.value } })
            }
            className={inputCls}
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Previously released?">
          <div className="flex gap-2">
            <PillToggle
              active={!state.previouslyReleased}
              onClick={() =>
                dispatch({
                  type: "patch",
                  patch: { previouslyReleased: false },
                })
              }
            >
              No, brand new
            </PillToggle>
            <PillToggle
              active={state.previouslyReleased}
              onClick={() =>
                dispatch({
                  type: "patch",
                  patch: { previouslyReleased: true },
                })
              }
            >
              Yes, re-release
            </PillToggle>
          </div>
        </Field>
      </div>

      <div className="mt-8">
        <h3 className="mb-3 text-sm font-medium">Cover artwork</h3>
        <CoverDropzone
          file={state.cover}
          error={state.coverError}
          artistName={
            profiles.find((p) => p.id === state.artistProfileId)?.name ?? ""
          }
          title={state.title}
          onChange={(file, error) =>
            dispatch({
              type: "patch",
              patch: { cover: file, coverError: error },
            })
          }
        />
      </div>

      {errors.length > 0 && <ErrorList errors={errors} />}
    </StepCard>
  );
}

function CoverDropzone({
  file,
  error,
  artistName,
  title,
  onChange,
}: {
  file: File | null;
  error: string | null;
  artistName: string;
  title: string;
  onChange: (f: File | null, err: string | null) => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const u = URL.createObjectURL(file);
    setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  function accept(f: File) {
    if (!IMAGE_EXTS.includes(extOf(f.name))) {
      onChange(null, "Filformat stöds inte. Tillåtet: JPG, PNG, WEBP.");
      return;
    }
    if (f.size > MAX_IMAGE_BYTES) {
      onChange(null, `För stor (${formatBytes(f.size)}).`);
      return;
    }
    onChange(f, null);
  }

  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files?.[0];
    if (f) accept(f);
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        className={`group relative flex aspect-square w-full max-w-[260px] cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed bg-background/40 transition ${
          drag
            ? "border-primary bg-primary/10"
            : "border-border hover:border-primary/50"
        }`}
      >
        {preview ? (
          <>
            <img
              src={preview}
              alt="Cover preview"
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 flex items-end justify-end bg-gradient-to-t from-black/60 via-black/0 to-transparent p-3 opacity-0 transition group-hover:opacity-100">
              <span className="rounded-md bg-background/80 px-2 py-1 text-xs">
                Click to replace
              </span>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 p-6 text-center">
            <ImageIcon className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm font-medium">Drop cover here</p>
            <p className="text-xs text-muted-foreground">
              JPG, PNG eller WEBP · 1:1 rekommenderat · max{" "}
              {formatBytes(MAX_IMAGE_BYTES)}
            </p>
          </div>
        )}
        <input
          type="file"
          accept={IMAGE_ACCEPT}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) accept(f);
            e.target.value = "";
          }}
          className="sr-only"
        />
      </label>

      <div className="flex-1 space-y-3">
        {file && (
          <div className="rounded-lg border border-border bg-background/50 p-3 text-xs">
            <p className="truncate font-medium">{file.name}</p>
            <p className="text-muted-foreground">{formatBytes(file.size)}</p>
          </div>
        )}
        {error && (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={() => setAiOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background/80 px-3 py-2 text-xs font-medium hover:bg-secondary"
        >
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Skapa omslag med AI
        </button>
        <p className="text-xs text-muted-foreground">
          Tips: konstnärligt, abstrakt motiv håller bättre över tid än trender.
        </p>
      </div>

      <AiArtworkDialog
        open={aiOpen}
        aspect="1:1"
        title="Skapa omslag med AI"
        filenameHint={`release-${title || "untitled"}`}
        defaultPrompt={`Abstrakt albumomslag för "${title || "släppet"}"${
          artistName ? ` av ${artistName}` : ""
        }, cinematic Scandinavian, ingen text, inga ansikten`}
        onClose={() => setAiOpen(false)}
        onGenerated={(f) => {
          onChange(f, null);
          setAiOpen(false);
        }}
      />
    </div>
  );
}

// ============================================================
// Step 2 — Platforms
// ============================================================
function StepPlatforms({
  state,
  dispatch,
}: {
  state: ReleaseState;
  dispatch: React.Dispatch<Action>;
}) {
  return (
    <StepCard
      step={2}
      title="Plattformar (endast referens)"
      description="Markera var releasen skulle distribueras. I demo-läget är distributionen inte aktiv."
    >
      <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Plattformsvalet sparas endast som referens.{" "}
          <span className="font-semibold">
            Ingen faktisk distribution till streamingtjänster sker i demo-läget.
          </span>{" "}
          Releasen hamnar i katalogen och skickas till Radio Uppsala.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {PLATFORMS.map((p) => {
          const active = state.platforms.includes(p.code);
          const Icon = p.icon;
          return (
            <button
              key={p.code}
              type="button"
              onClick={() => dispatch({ type: "togglePlatform", code: p.code })}
              className={`group relative flex items-start gap-3 overflow-hidden rounded-xl border p-4 text-left transition ${
                active
                  ? "border-primary/50 bg-gradient-to-br from-primary/10 to-accent/5 shadow-sm"
                  : "border-border bg-background/40 hover:border-primary/30 hover:bg-secondary/40"
              }`}
            >
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                  active
                    ? "bg-primary/20 text-primary"
                    : "bg-secondary text-muted-foreground"
                }`}
              >
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{p.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {p.hint}
                </span>
              </span>
              {active && (
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="h-3 w-3" />
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Tip: pick all of them — du betalar inget extra och varje plattform når
        olika lyssnare.
      </p>
      <div className="mt-3 flex gap-2 text-xs">
        <button
          onClick={() =>
            dispatch({
              type: "patch",
              patch: { platforms: PLATFORMS.map((p) => p.code) },
            })
          }
          className="rounded-md border border-border px-3 py-1.5 hover:bg-secondary"
        >
          Select all
        </button>
        <button
          onClick={() => dispatch({ type: "patch", patch: { platforms: [] } })}
          className="rounded-md border border-border px-3 py-1.5 hover:bg-secondary"
        >
          Clear
        </button>
      </div>
    </StepCard>
  );
}

// ============================================================
// Step 3 — Tracks
// ============================================================
function StepTracks({
  state,
  dispatch,
}: {
  state: ReleaseState;
  dispatch: React.Dispatch<Action>;
}) {
  const { user } = useAuth();
  const [drag, setDrag] = useState(false);

  async function handleFiles(files: File[]) {
    if (!user || !files.length) return;
    const newDrafts: TrackDraft[] = files.map((f) => {
      const ok = AUDIO_EXTS.includes(extOf(f.name)) && f.size <= MAX_AUDIO_BYTES;
      return {
        id: newId(),
        file: f,
        audioPath: null,
        uploadPct: 0,
        status: ok ? "queued" : "error",
        errorMsg: ok
          ? null
          : f.size > MAX_AUDIO_BYTES
            ? `För stor (${formatBytes(f.size)})`
            : "Ogiltigt format",
        title: baseName(f.name),
        version: "",
        featuredArtists: "",
        isrc: "",
        explicit: false,
        instrumental: false,
        aiGenerated: false,
        previewStart: 0,
        songwriters: "",
        producers: "",
        atmosAvailable: false,
        atmosFile: null,
        durationSeconds: null,
        loudnessLufs: null,
      };
    });
    dispatch({ type: "addTracks", tracks: newDrafts });

    for (const d of newDrafts) {
      if (d.status === "error") continue;
      void detectDuration(d.file).then((sec) =>
        dispatch({
          type: "updateTrack",
          id: d.id,
          patch: { durationSeconds: sec },
        }),
      );
      await uploadOne(d);
    }
  }

  async function uploadOne(d: TrackDraft) {
    if (!user) return;
    dispatch({
      type: "updateTrack",
      id: d.id,
      patch: { status: "uploading", uploadPct: 10, errorMsg: null },
    });
    try {
      const stamp = Date.now();
      const path = `${user.id}/release-${stamp}-${sanitize(d.file.name)}`;
      const up = await supabase.storage.from("audio").upload(path, d.file, {
        cacheControl: "3600",
        upsert: false,
        contentType: d.file.type || undefined,
      });
      if (up.error) throw up.error;
      dispatch({
        type: "updateTrack",
        id: d.id,
        patch: { status: "ready", uploadPct: 100, audioPath: path },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Upload failed";
      dispatch({
        type: "updateTrack",
        id: d.id,
        patch: { status: "error", errorMsg: msg },
      });
    }
  }

  return (
    <StepCard
      step={3}
      title="Tracks"
      description="Lägg till alla låtar för releasen. Drag-and-drop eller välj filer."
    >
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const files = Array.from(e.dataTransfer.files ?? []);
          void handleFiles(files);
        }}
        className={`flex h-40 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed bg-background/40 transition ${
          drag
            ? "border-primary bg-primary/10"
            : "border-border hover:border-primary/40"
        }`}
      >
        <UploadIcon className="h-8 w-8 text-muted-foreground" />
        <p className="mt-3 text-sm font-medium">
          {state.tracks.length === 0
            ? "Drop audio files here"
            : "Add more tracks"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {AUDIO_EXTS.join(", ").toUpperCase()} · up to{" "}
          {formatBytes(MAX_AUDIO_BYTES)} each
        </p>
        <input
          type="file"
          accept={AUDIO_ACCEPT}
          multiple
          className="sr-only"
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            void handleFiles(files);
          }}
        />
      </label>

      {state.tracks.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-border bg-background/30 px-4 py-8 text-center">
          <Music2 className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">No tracks yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Lägg till minst en låt för att fortsätta.
          </p>
        </div>
      ) : (
        <ul className="mt-6 space-y-4">
          {state.tracks.map((t, idx) => (
            <TrackMetadataCard
              key={t.id}
              track={t}
              index={idx + 1}
              onChange={(patch) =>
                dispatch({ type: "updateTrack", id: t.id, patch })
              }
              onRemove={async () => {
                if (t.audioPath) {
                  await supabase.storage.from("audio").remove([t.audioPath]);
                }
                dispatch({ type: "removeTrack", id: t.id });
              }}
              onRetry={() => uploadOne(t)}
            />
          ))}
        </ul>
      )}
    </StepCard>
  );
}

function detectDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(file);
      const a = new Audio();
      a.preload = "metadata";
      a.src = url;
      a.onloadedmetadata = () => {
        const d = a.duration;
        URL.revokeObjectURL(url);
        resolve(isFinite(d) ? d : null);
      };
      a.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
    } catch {
      resolve(null);
    }
  });
}

function TrackMetadataCard({
  track,
  index,
  onChange,
  onRemove,
  onRetry,
}: {
  track: TrackDraft;
  index: number;
  onChange: (patch: Partial<TrackDraft>) => void;
  onRemove: () => void;
  onRetry: () => void;
}) {
  const isrcInvalid =
    track.isrc.trim() && !ISRC_RE.test(track.isrc.trim().toUpperCase());

  return (
    <li className="overflow-hidden rounded-xl border border-border bg-card/60 backdrop-blur">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-border bg-background/40 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
            {index}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {track.title || track.file.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatBytes(track.file.size)} ·{" "}
              {formatDuration(track.durationSeconds)} ·{" "}
              <TrackStatusLabel track={track} />
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {track.status === "error" && (
            <button
              onClick={onRetry}
              className="rounded-md border border-border px-2 py-1 text-xs hover:bg-secondary"
            >
              Retry
            </button>
          )}
          <button
            onClick={onRemove}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border hover:bg-secondary"
            aria-label="Remove track"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Progress */}
      {track.status === "uploading" && (
        <div className="h-1 w-full bg-muted">
          <div
            className="h-full bg-gradient-to-r from-primary to-accent transition-all"
            style={{ width: `${track.uploadPct}%` }}
          />
        </div>
      )}

      {/* Body */}
      <div className="grid gap-4 p-4 md:grid-cols-2">
        <Field label="Track title" required>
          <input
            type="text"
            value={track.title}
            onChange={(e) => onChange({ title: e.target.value })}
            className={inputCls}
          />
        </Field>
        <Field label="Version" hint="Ex. Radio Edit, Acoustic">
          <input
            type="text"
            value={track.version}
            onChange={(e) => onChange({ version: e.target.value })}
            className={inputCls}
          />
        </Field>
        <Field label="Featured artists" hint="Komma-separerat">
          <input
            type="text"
            value={track.featuredArtists}
            onChange={(e) => onChange({ featuredArtists: e.target.value })}
            className={inputCls}
          />
        </Field>
        <Field
          label="ISRC"
          hint="12 tecken, ex. SE-ABC-25-12345"
          error={isrcInvalid ? "Format ser ogiltigt ut" : undefined}
        >
          <input
            type="text"
            value={track.isrc}
            onChange={(e) => onChange({ isrc: e.target.value.toUpperCase() })}
            maxLength={12}
            className={inputCls}
          />
        </Field>
        <Field label="Songwriters" hint="Komma-separerat">
          <input
            type="text"
            value={track.songwriters}
            onChange={(e) => onChange({ songwriters: e.target.value })}
            className={inputCls}
          />
        </Field>
        <Field label="Producer credits" hint="Komma-separerat">
          <input
            type="text"
            value={track.producers}
            onChange={(e) => onChange({ producers: e.target.value })}
            className={inputCls}
          />
        </Field>
        <Field label="Preview clip start (sec)">
          <input
            type="number"
            min={0}
            value={track.previewStart}
            onChange={(e) =>
              onChange({ previewStart: Number(e.target.value) || 0 })
            }
            className={inputCls}
          />
        </Field>
        <Field label="Loudness (LUFS)" hint="Auto-detekteras vid review">
          <input
            disabled
            placeholder="—"
            className={`${inputCls} opacity-60`}
          />
        </Field>

        <div className="md:col-span-2">
          <div className="flex flex-wrap gap-2">
            <Toggle
              label="Explicit lyrics"
              active={track.explicit}
              onClick={() => onChange({ explicit: !track.explicit })}
            />
            <Toggle
              label="Instrumental"
              active={track.instrumental}
              onClick={() => onChange({ instrumental: !track.instrumental })}
            />
            <Toggle
              label="AI-generated content"
              active={track.aiGenerated}
              onClick={() => onChange({ aiGenerated: !track.aiGenerated })}
            />
            <Toggle
              label="Dolby Atmos available"
              active={track.atmosAvailable}
              onClick={() =>
                onChange({ atmosAvailable: !track.atmosAvailable })
              }
            />
          </div>
        </div>

        {track.atmosAvailable && (
          <div className="md:col-span-2">
            <Field label="Upload Atmos mix">
              {track.atmosFile ? (
                <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-xs">
                  <span className="truncate flex-1">{track.atmosFile.name}</span>
                  <button
                    onClick={() => onChange({ atmosFile: null })}
                    className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-secondary"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <label className="flex h-14 cursor-pointer items-center justify-center rounded-md border border-dashed border-border text-xs hover:bg-secondary/40">
                  <UploadIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                  Select Atmos file
                  <input
                    type="file"
                    accept={AUDIO_ACCEPT}
                    className="sr-only"
                    onChange={(e) =>
                      onChange({ atmosFile: e.target.files?.[0] ?? null })
                    }
                  />
                </label>
              )}
            </Field>
          </div>
        )}
      </div>
    </li>
  );
}

function TrackStatusLabel({ track }: { track: TrackDraft }) {
  switch (track.status) {
    case "queued":
      return <span className="text-muted-foreground">Queued</span>;
    case "uploading":
      return (
        <span className="inline-flex items-center gap-1 text-primary">
          <Loader2 className="h-3 w-3 animate-spin" />
          Uploading {track.uploadPct}%
        </span>
      );
    case "ready":
      return <span className="text-emerald-400">Uploaded</span>;
    case "error":
      return <span className="text-destructive">{track.errorMsg ?? "Error"}</span>;
  }
}

// ============================================================
// Step 4 — Rights
// ============================================================
function StepRights({
  state,
  dispatch,
}: {
  state: ReleaseState;
  dispatch: React.Dispatch<Action>;
}) {
  const items: Array<{ key: keyof ReleaseState["rights"]; label: string }> = [
    { key: "owns", label: "I own or control the rights to this music" },
    { key: "permission", label: "I have permission to distribute this content" },
    { key: "policies", label: "I understand this is a demo catalog submission, not streaming distribution" },
    { key: "noManipulation", label: "No artificial stream manipulation" },
    { key: "terms", label: "I agree to the catalog submission terms" },
  ];
  return (
    <StepCard
      step={4}
      title="Rights & Ownership"
      description="Bekräfta att du har rätt att distribuera musiken."
    >
      <ul className="space-y-3">
        {items.map((it) => {
          const active = state.rights[it.key];
          return (
            <li key={it.key}>
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${
                  active
                    ? "border-primary/40 bg-primary/5"
                    : "border-border bg-background/40 hover:bg-secondary/40"
                }`}
              >
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) =>
                    dispatch({
                      type: "patchRights",
                      patch: { [it.key]: e.target.checked },
                    })
                  }
                  className="mt-0.5 h-4 w-4 accent-primary"
                />
                <span className="text-sm">{it.label}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </StepCard>
  );
}

// ============================================================
// Step 5 — Review
// ============================================================
function StepReview({
  state,
  profiles,
  errors,
  onJump,
}: {
  state: ReleaseState;
  profiles: ArtistProfile[];
  errors: Record<StepId, string[]>;
  onJump: (id: StepId) => void;
}) {
  const [cover, setCover] = useState<string | null>(null);
  useEffect(() => {
    if (!state.cover) {
      setCover(null);
      return;
    }
    const u = URL.createObjectURL(state.cover);
    setCover(u);
    return () => URL.revokeObjectURL(u);
  }, [state.cover]);

  const artist = profiles.find((p) => p.id === state.artistProfileId)?.name ?? "—";
  const allErrors = Object.entries(errors).flatMap(([id, arr]) =>
    arr.map((e) => ({ step: Number(id) as StepId, msg: e })),
  );

  return (
    <StepCard
      step={5}
      title="Review & Submit"
      description="Sista koll innan vi skickar releasen för granskning."
    >
      <div className="overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card to-background">
        <div className="grid gap-6 p-6 sm:grid-cols-[180px_1fr]">
          <div className="aspect-square w-full max-w-[180px] overflow-hidden rounded-xl bg-muted">
            {cover ? (
              <img src={cover} alt="Cover" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                <ImageIcon className="h-8 w-8" />
              </div>
            )}
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              {state.label || "—"}
            </p>
            <h3 className="font-display mt-1 text-2xl font-semibold">
              {state.title || "Untitled"}
            </h3>
            <p className="text-sm text-muted-foreground">{artist}</p>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <Meta k="Release date" v={state.releaseDate || "—"} />
              <Meta k="Primary genre" v={state.primaryGenre || "—"} />
              <Meta k="Secondary genre" v={state.secondaryGenre || "—"} />
              <Meta k="Language" v={state.language} />
              <Meta
                k="Tracks"
                v={String(state.tracks.length)}
              />
              <Meta
                k="Previously released"
                v={state.previouslyReleased ? "Yes" : "No"}
              />
            </dl>
          </div>
        </div>

        <div className="border-t border-border p-6">
          <h4 className="mb-3 text-sm font-semibold">Distribution</h4>
          <p className="mb-3 text-xs text-amber-700 dark:text-amber-300">
            Endast referens — ingen faktisk distribution till streamingtjänster
            sker i demo-läget. Releasen skickas till katalogen och Radio Uppsala.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {state.platforms.length === 0 ? (
              <span className="text-xs text-muted-foreground">None selected</span>
            ) : (
              state.platforms.map((code) => {
                const p = PLATFORMS.find((x) => x.code === code);
                if (!p) return null;
                const Icon = p.icon;
                return (
                  <span
                    key={code}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-2.5 py-1 text-xs"
                  >
                    <Icon className="h-3 w-3 text-primary" />
                    {p.name}
                  </span>
                );
              })
            )}
          </div>
        </div>

        <div className="border-t border-border p-6">
          <h4 className="mb-3 text-sm font-semibold">Tracks</h4>
          {state.tracks.length === 0 ? (
            <p className="text-xs text-muted-foreground">No tracks added.</p>
          ) : (
            <ol className="space-y-2">
              {state.tracks.map((t, i) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between rounded-md border border-border bg-background/40 px-3 py-2 text-xs"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="text-muted-foreground">{i + 1}.</span>
                    <span className="truncate font-medium">
                      {t.title || t.file.name}
                    </span>
                    {t.version && (
                      <span className="text-muted-foreground">
                        ({t.version})
                      </span>
                    )}
                    {t.explicit && (
                      <span className="rounded bg-destructive/20 px-1.5 py-0.5 text-[10px] font-bold text-destructive">
                        E
                      </span>
                    )}
                  </span>
                  <span className="text-muted-foreground">
                    {formatDuration(t.durationSeconds)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {allErrors.length > 0 && (
        <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <p className="mb-2 text-sm font-medium text-destructive">
            Fix dessa innan submit:
          </p>
          <ul className="space-y-1 text-xs">
            {allErrors.map((e, i) => (
              <li key={i} className="flex items-center justify-between">
                <span>• {e.msg}</span>
                <button
                  onClick={() => onJump(e.step)}
                  className="rounded border border-destructive/30 px-2 py-0.5 text-[10px] text-destructive hover:bg-destructive/10"
                >
                  Go to step {e.step}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </StepCard>
  );
}

function Meta({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="font-medium">{v}</dd>
    </>
  );
}

// ============================================================
// Demo notice
// ============================================================
function DemoNotice({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300 ${className}`}
    >
      <Info className="mt-0.5 h-4 w-4 shrink-0" />
      <p>
        <span className="font-semibold">Demo-läge.</span> Din release sparas i
        Media Rosenqvist Catalog och skickas till Radio Uppsala för granskning.
        Distribution till Spotify, Apple Music och andra streamingtjänster är{" "}
        <span className="font-semibold">inte aktiv</span> — låtarna publiceras
        alltså inte på dessa plattformar.
      </p>
    </div>
  );
}

// ============================================================
// Floating save bar
// ============================================================
function FloatingSaveBar({
  dirty,
  saving,
  savedAt,
  error,
  canSave,
  onSave,
}: {
  dirty: boolean;
  saving: boolean;
  savedAt: Date | null;
  error: string | null;
  canSave: boolean;
  onSave: () => void;
}) {
  let status: ReactNode;
  if (saving) {
    status = (
      <span className="inline-flex items-center gap-1.5 text-primary">
        <Loader2 className="h-3 w-3 animate-spin" /> Sparar…
      </span>
    );
  } else if (error) {
    status = <span className="text-destructive">{error}</span>;
  } else if (dirty) {
    status = <span className="text-muted-foreground">Osparade ändringar</span>;
  } else if (savedAt) {
    status = (
      <span className="text-muted-foreground">
        Sparat {savedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </span>
    );
  } else {
    status = <span className="text-muted-foreground">Inget sparat ännu</span>;
  }

  return (
    <div className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2">
      <div className="flex items-center gap-3 rounded-full border border-border bg-card/90 px-3 py-2 text-xs shadow-2xl backdrop-blur">
        <span className="px-2">{status}</span>
        <button
          onClick={onSave}
          disabled={!canSave || saving}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Save className="h-3 w-3" />
          Save Draft
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Small UI atoms
// ============================================================
const inputCls =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground/60";

function StepCard({
  step,
  title,
  description,
  children,
}: {
  step: number;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card/60 p-6 backdrop-blur-sm shadow-sm sm:p-8">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          Step {step}
        </p>
        <h2 className="font-display mt-1 text-2xl font-semibold tracking-tight">
          {title}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </header>
      {children}
    </section>
  );
}

function Field({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-1 text-xs font-medium">
        {label}
        {required && <span className="text-destructive">*</span>}
      </span>
      {children}
      {hint && !error && (
        <span className="mt-1 block text-[11px] text-muted-foreground">
          {hint}
        </span>
      )}
      {error && (
        <span className="mt-1 block text-[11px] text-destructive">{error}</span>
      )}
    </label>
  );
}

function PillToggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-3 py-2 text-xs font-medium transition ${
        active
          ? "border-primary/50 bg-primary/15 text-foreground"
          : "border-border bg-background hover:bg-secondary"
      }`}
    >
      {children}
    </button>
  );
}

function Toggle({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
        active
          ? "border-primary/50 bg-primary/15 text-foreground"
          : "border-border bg-background/60 text-muted-foreground hover:text-foreground"
      }`}
    >
      <span
        className={`h-2 w-2 rounded-full ${
          active ? "bg-primary" : "bg-muted-foreground/40"
        }`}
      />
      {label}
    </button>
  );
}

function ErrorList({ errors }: { errors: string[] }) {
  return (
    <ul className="mt-6 space-y-1 rounded-md border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
      {errors.map((e, i) => (
        <li key={i}>• {e}</li>
      ))}
    </ul>
  );
}