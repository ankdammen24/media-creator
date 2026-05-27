import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Radio, Music2, Clock } from "lucide-react";
import { nowPlayingQuery } from "@/lib/queries";
import { SourceBadge } from "./SourceBadge";

function formatDuration(seconds: number) {
  if (!seconds || seconds <= 0) return null;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function timeSince(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  return `${hr}h ago`;
}

function useLiveElapsed(playedAt?: string) {
  const [label, setLabel] = useState(() => (playedAt ? timeSince(playedAt) : ""));
  useEffect(() => {
    if (!playedAt) return;
    setLabel(timeSince(playedAt));
    const id = setInterval(() => setLabel(timeSince(playedAt)), 5000);
    return () => clearInterval(id);
  }, [playedAt]);
  return label;
}

export function NowPlaying() {
  const { data, isLoading, isError } = useQuery(nowPlayingQuery());

  if (isLoading) {
    return (
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex items-center gap-4 p-4">
          <div className="h-20 w-20 flex-shrink-0 animate-pulse rounded-xl bg-secondary" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-1/3 animate-pulse rounded bg-secondary" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-secondary" />
            <div className="h-3 w-1/4 animate-pulse rounded bg-secondary" />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !data?.nowPlaying) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
        <div className="flex items-center gap-3">
          <Radio className="h-5 w-5" />
          <span>Radio Uppsala stream is currently unavailable. Check back soon.</span>
        </div>
      </div>
    );
  }

  const np = data.nowPlaying;
  const elapsed = useLiveElapsed(np.playedAt);
  const dur = formatDuration(np.duration ?? 0);

  const recent = useMemo(() => {
    if (!data.tracks || data.tracks.length <= 1) return [];
    return data.tracks.slice(1, 4);
  }, [data.tracks]);

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex items-start gap-4 p-4 sm:items-center sm:gap-5 sm:p-5">
        {/* Artwork */}
        <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-secondary sm:h-24 sm:w-24">
          {np.art ? (
            <img
              src={np.art}
              alt={np.title || "Now playing"}
              className="h-full w-full object-cover"
              loading="eager"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Music2 className="h-8 w-8 text-muted-foreground" />
            </div>
          )}
          {/* Live overlay dot */}
          <div className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-white/20 bg-black/40 backdrop-blur-sm">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent" />
            </span>
          </div>
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
              </span>
              Live
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {data.station || "Radio Uppsala"}
            </span>
          </div>

          <h3 className="truncate text-base font-bold text-foreground sm:text-lg">
            {np.title || "—"}
          </h3>
          <p className="truncate text-sm text-muted-foreground">
            {np.artist || "Unknown artist"}
            {np.album ? ` · ${np.album}` : ""}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <SourceBadge source="azuracast" />
            {np.playedAt && (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <Clock className="h-3 w-3" />
                {elapsed}
              </span>
            )}
            {dur && (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <Clock className="h-3 w-3" />
                {dur}
              </span>
            )}
          </div>
        </div>

        {/* Station icon */}
        <div className="hidden sm:flex flex-col items-end gap-2">
          <Radio className="h-5 w-5 text-muted-foreground" />
        </div>
      </div>

      {/* Recent tracks */}
      {recent.length > 0 && (
        <div className="border-t border-border bg-secondary/30 px-4 py-3 sm:px-5">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Recently played
          </p>
          <div className="flex flex-col gap-2">
            {recent.map((t, i) => (
              <div
                key={t.externalId || `${t.title}-${i}`}
                className="flex items-center gap-3 rounded-lg p-1.5 transition hover:bg-secondary"
              >
                <div className="h-9 w-9 flex-shrink-0 overflow-hidden rounded-md bg-secondary">
                  {t.art ? (
                    <img
                      src={t.art}
                      alt={t.title || ""}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Music2 className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-foreground">
                    {t.title || "—"}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {t.artist || "Unknown artist"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
