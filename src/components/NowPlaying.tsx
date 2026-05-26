import { useQuery } from "@tanstack/react-query";
import { Radio, Music2 } from "lucide-react";
import { nowPlayingQuery } from "@/lib/queries";
import { SourceBadge } from "./SourceBadge";

export function NowPlaying() {
  const { data, isLoading, isError } = useQuery(nowPlayingQuery());

  if (isLoading) {
    return (
      <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
        <div className="h-16 w-16 animate-pulse rounded-md bg-secondary" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-1/2 animate-pulse rounded bg-secondary" />
          <div className="h-3 w-1/3 animate-pulse rounded bg-secondary" />
        </div>
      </div>
    );
  }

  if (isError || !data?.nowPlaying) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
        Radio Uppsala stream unavailable.
      </div>
    );
  }

  const np = data.nowPlaying;
  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
      <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-md bg-secondary">
        {np.art ? (
          <img src={np.art} alt={np.title || "Now playing"} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Music2 className="h-6 w-6 text-muted-foreground" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-accent">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
            </span>
            Live · {data.station || "Radio Uppsala"}
          </span>
        </div>
        <h3 className="line-clamp-1 text-sm font-semibold text-foreground">{np.title || "—"}</h3>
        <p className="line-clamp-1 text-xs text-muted-foreground">{np.artist || "Unknown artist"}</p>
      </div>
      <div className="hidden sm:flex flex-col items-end gap-2">
        <SourceBadge source="azuracast" />
        <Radio className="h-4 w-4 text-muted-foreground" />
      </div>
    </div>
  );
}