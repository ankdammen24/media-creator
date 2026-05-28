import { Pause, Play, X, Music2, Mic } from "lucide-react";
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
  const { current, isPlaying, progress, duration, toggle, seek, close } = usePlayer();
  if (!current) return null;

  const artUrl = supabase.storage.from("artwork").getPublicUrl(current.artworkPath).data.publicUrl;
  const pct = duration > 0 ? (progress / duration) * 100 : 0;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card/85 backdrop-blur-lg">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5 sm:px-6">
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

        <button
          type="button"
          onClick={toggle}
          aria-label={isPlaying ? "Pause" : "Play"}
          className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition hover:opacity-90"
        >
          {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 translate-x-[1px]" />}
        </button>

        <button
          type="button"
          onClick={close}
          aria-label="Close player"
          className="hidden h-9 w-9 flex-shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-foreground sm:inline-flex"
        >
          <X className="h-4 w-4" />
        </button>
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