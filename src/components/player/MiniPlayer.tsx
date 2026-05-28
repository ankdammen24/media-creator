import { Pause, Play, X, Music2, Mic, SkipBack, SkipForward, Square } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { usePlayer } from "./PlayerProvider";
import { supabase } from "@/integrations/supabase/client";

function fmt(seconds: number) {
  if (!isFinite(seconds) || seconds <= 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function MiniPlayer() {
  const {
    current,
    isPlaying,
    progress,
    duration,
    toggle,
    seek,
    close,
    skipNext,
    skipPrev,
    hasNext,
    hasPrev,
  } = usePlayer();
  if (!current) return null;

  const artUrl = supabase.storage.from("artwork").getPublicUrl(current.artworkPath).data.publicUrl;
  const pct = duration > 0 ? (progress / duration) * 100 : 0;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card/85 backdrop-blur-lg"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex max-w-7xl items-center gap-2 px-2 py-2.5 sm:gap-3 sm:px-6">
        <img
          src={artUrl}
          alt=""
          className="h-12 w-12 flex-shrink-0 rounded-md object-cover"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
            {current.mediaType === "music" ? (
              <Music2 className="h-3 w-3" />
            ) : (
              <Mic className="h-3 w-3" />
            )}
            {current.mediaType}
          </div>
          <p className="line-clamp-1 text-sm font-semibold text-foreground">{current.title}</p>
          {current.artist ? (
            current.artistId ? (
              <Link
                to="/artists/$artistId"
                params={{ artistId: current.artistId }}
                className="line-clamp-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
              >
                {current.artist}
              </Link>
            ) : (
              <p className="line-clamp-1 text-xs text-muted-foreground">{current.artist}</p>
            )
          ) : null}
        </div>

        <div className="flex flex-shrink-0 items-center gap-0.5 sm:gap-1">
          <button
            type="button"
            onClick={skipPrev}
            disabled={!hasPrev}
            aria-label="Föregående"
            className="inline-flex h-11 w-11 items-center justify-center rounded-md text-foreground transition hover:bg-secondary disabled:opacity-30"
          >
            <SkipBack className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={toggle}
            aria-label={isPlaying ? "Pause" : "Play"}
            className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground transition hover:opacity-90"
          >
            {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6 translate-x-[1px]" />}
          </button>
          <button
            type="button"
            onClick={skipNext}
            disabled={!hasNext}
            aria-label="Nästa"
            className="inline-flex h-11 w-11 items-center justify-center rounded-md text-foreground transition hover:bg-secondary disabled:opacity-30"
          >
            <SkipForward className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={close}
            aria-label="Stoppa"
            className="inline-flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            title="Stoppa"
          >
            <Square className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={close}
            aria-label="Stäng spelare"
            className="hidden h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-foreground sm:inline-flex"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div
        className="group relative h-1 cursor-pointer bg-secondary"
        onClick={(e) => {
          if (duration <= 0) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const ratio = (e.clientX - rect.left) / rect.width;
          seek(ratio * duration);
        }}
      >
        <div
          className="h-full bg-primary transition-[width] duration-100"
          style={{ width: `${pct}%` }}
        />
        <div className="pointer-events-none absolute inset-x-3 -top-5 hidden justify-between text-[10px] text-muted-foreground group-hover:flex">
          <span>{fmt(progress)}</span>
          <span>{fmt(duration)}</span>
        </div>
      </div>
    </div>
  );
}