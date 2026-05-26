import { Link } from "@tanstack/react-router";
import { Play, Music2 } from "lucide-react";
import type { Track } from "@/lib/api";
import { SourceBadge } from "./SourceBadge";

export function TrackCard({ track }: { track: Track }) {
  const art = track.artworkUrl || track.art;
  const title = track.title || "Untitled";
  const artist = track.artist || "Unknown artist";
  return (
    <Link
      to="/tracks/$trackId"
      params={{ trackId: track.id }}
      className="group block overflow-hidden rounded-lg border border-border bg-card transition-all hover:border-primary/40 hover:bg-card/80"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-secondary">
        {art ? (
          <img
            src={art}
            alt={title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Music2 className="h-10 w-10 text-muted-foreground" />
          </div>
        )}
        <div className="absolute bottom-2 right-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
          <Play className="h-5 w-5 fill-current" />
        </div>
      </div>
      <div className="space-y-1.5 p-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-1 text-sm font-semibold text-foreground">{title}</h3>
        </div>
        <p className="line-clamp-1 text-xs text-muted-foreground">{artist}</p>
        <div className="pt-1">
          <SourceBadge source={track.source} />
        </div>
      </div>
    </Link>
  );
}