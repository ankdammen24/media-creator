import { useEditorRole } from "@/lib/useEditorRole";
import { cn } from "@/lib/utils";

type Tone = "default" | "accent" | "warn";
type Badge = { label: string; title?: string; tone?: Tone };

const toneClass: Record<Tone, string> = {
  default: "border-border bg-secondary text-muted-foreground",
  accent: "border-primary/40 bg-primary/10 text-primary",
  warn: "border-destructive/40 bg-destructive/10 text-destructive",
};

function BadgeRow({ badges }: { badges: Badge[] }) {
  if (badges.length === 0) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {badges.map((b, i) => (
        <span
          key={`${b.label}-${i}`}
          title={b.title}
          className={cn(
            "rounded border px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide leading-none",
            toneClass[b.tone ?? "default"],
          )}
        >
          {b.label}
        </span>
      ))}
    </div>
  );
}

function fmtDuration(s?: number | null) {
  if (s == null) return null;
  const total = Math.round(s);
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function arr(v?: string[] | null) {
  return (v ?? []).filter((x) => x && x.trim().length > 0);
}

/* ---------- Track / Låt ---------- */

export type EditorTrackMeta = {
  isrc?: string | null;
  upc?: string | null;
  version?: string | null;
  track_number?: number | null;
  duration_seconds?: number | null;
  loudness_lufs?: number | null;
  explicit?: boolean | null;
  instrumental?: boolean | null;
  ai_generated?: boolean | null;
  dolby_atmos_available?: boolean | null;
  songwriters?: string[] | null;
  producers?: string[] | null;
  featured_artists?: string[] | null;
  processing_status?: string | null;
};

function buildTrackBadges(t: EditorTrackMeta): Badge[] {
  const b: Badge[] = [];
  if (t.track_number != null) b.push({ label: `#${t.track_number}` });
  if (t.version) b.push({ label: t.version });
  const dur = fmtDuration(t.duration_seconds);
  if (dur) b.push({ label: dur });
  if (t.explicit) b.push({ label: "Explicit", tone: "warn" });
  if (t.instrumental) b.push({ label: "Instr." });
  if (t.ai_generated) b.push({ label: "AI", tone: "warn" });
  if (t.dolby_atmos_available) b.push({ label: "Atmos", tone: "accent" });
  if (t.isrc) b.push({ label: `ISRC ${t.isrc}`, title: `ISRC: ${t.isrc}` });
  if (t.upc) b.push({ label: `UPC ${t.upc}`, title: `UPC: ${t.upc}` });
  if (t.loudness_lufs != null) b.push({ label: `${t.loudness_lufs} LUFS` });
  const writers = arr(t.songwriters);
  if (writers.length) b.push({ label: `Writers ${writers.length}`, title: `Songwriters: ${writers.join(", ")}` });
  const producers = arr(t.producers);
  if (producers.length) b.push({ label: `Prod. ${producers.length}`, title: `Producers: ${producers.join(", ")}` });
  const feat = arr(t.featured_artists);
  if (feat.length) b.push({ label: `Feat. ${feat.length}`, title: `Featured: ${feat.join(", ")}` });
  return b;
}

export function EditorTrackMeta({ meta }: { meta: EditorTrackMeta }) {
  const { isEditor } = useEditorRole();
  if (!isEditor) return null;
  return <BadgeRow badges={buildTrackBadges(meta)} />;
}

/* ---------- Album ---------- */

export type EditorAlbumMeta = {
  status?: string | null;
  upc?: string | null;
  label?: string | null;
  language?: string | null;
  genre?: string | null;
  secondary_genre?: string | null;
  distribution_platforms?: string[] | null;
  previously_released?: boolean | null;
  release_date?: string | null;
};

function buildAlbumBadges(a: EditorAlbumMeta): Badge[] {
  const b: Badge[] = [];
  if (a.status) b.push({ label: a.status.replace(/_/g, " "), tone: a.status === "published" ? "accent" : "default" });
  if (a.genre) b.push({ label: a.genre });
  if (a.secondary_genre) b.push({ label: a.secondary_genre });
  if (a.language) b.push({ label: a.language });
  if (a.label) b.push({ label: a.label, title: `Label: ${a.label}` });
  if (a.upc) b.push({ label: `UPC ${a.upc}`, title: `UPC: ${a.upc}` });
  const dist = arr(a.distribution_platforms);
  if (dist.length) b.push({ label: `${dist.length} platforms`, title: dist.join(", ") });
  if (a.previously_released) b.push({ label: "Re-release" });
  return b;
}

export function EditorAlbumMeta({ meta }: { meta: EditorAlbumMeta }) {
  const { isEditor } = useEditorRole();
  if (!isEditor) return null;
  return <BadgeRow badges={buildAlbumBadges(meta)} />;
}

/* ---------- Artist ---------- */

export type EditorArtistMeta = {
  approval_status?: string | null;
};

function buildArtistBadges(a: EditorArtistMeta): Badge[] {
  const b: Badge[] = [];
  if (a.approval_status)
    b.push({
      label: a.approval_status,
      tone: a.approval_status === "approved" ? "accent" : a.approval_status === "rejected" ? "warn" : "default",
    });
  return b;
}

export function EditorArtistMeta({ meta }: { meta: EditorArtistMeta }) {
  const { isEditor } = useEditorRole();
  if (!isEditor) return null;
  return <BadgeRow badges={buildArtistBadges(meta)} />;
}