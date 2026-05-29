import { Play, Pause, Loader2 } from "lucide-react";
import { usePlayer, type PlayerTrack } from "./PlayerProvider";

type Props = {
  track: PlayerTrack;
  size?: "sm" | "md" | "lg";
  className?: string;
  variant?: "solid" | "overlay";
};

export function PlayButton({ track, size = "md", className = "", variant = "solid" }: Props) {
  const { current, isPlaying, isLoading, play, prime } = usePlayer();
  const active = current?.id === track.id;
  const showPause = active && isPlaying;
  const showLoader = active && isLoading;

  const sizeClasses =
    size === "lg"
      ? "h-14 w-14"
      : size === "sm"
      ? "h-8 w-8"
      : "h-11 w-11";
  const iconSize = size === "lg" ? "h-6 w-6" : size === "sm" ? "h-3.5 w-3.5" : "h-5 w-5";

  const base =
    variant === "overlay"
      ? "bg-primary text-primary-foreground shadow-lg shadow-black/30 hover:scale-105 hover:bg-primary active:scale-95"
      : "bg-primary text-primary-foreground hover:opacity-90";

  return (
    <button
      type="button"
      aria-label={showPause ? `Pause ${track.title}` : `Play ${track.title}`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        // iOS Safari: unlock the audio decks synchronously inside the
        // gesture, BEFORE play() awaits the signed URL.
        prime();
        play(track);
      }}
      className={`inline-flex items-center justify-center rounded-full transition ${sizeClasses} ${base} ${className}`}
    >
      {showLoader ? (
        <Loader2 className={`${iconSize} animate-spin`} />
      ) : showPause ? (
        <Pause className={iconSize} />
      ) : (
        <Play className={`${iconSize} translate-x-[1px]`} />
      )}
    </button>
  );
}