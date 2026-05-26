import { useEffect, useRef, useState } from "react";
import { Play, Pause, AlertCircle } from "lucide-react";
import { previewUrl } from "@/lib/api";

function fmt(sec: number) {
  if (!isFinite(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function PreviewPlayer({ trackId }: { trackId: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    setPlaying(false);
    setCurrent(0);
    setDuration(0);
  }, [trackId]);

  const toggle = async () => {
    const a = audioRef.current;
    if (!a) return;
    try {
      if (a.paused) {
        await a.play();
        setPlaying(true);
      } else {
        a.pause();
        setPlaying(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Playback failed");
    }
  };

  const seek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const a = audioRef.current;
    if (!a || !duration) return;
    const t = (Number(e.target.value) / 100) * duration;
    a.currentTime = t;
    setCurrent(t);
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <audio
        ref={audioRef}
        src={previewUrl(trackId)}
        preload="metadata"
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onEnded={() => setPlaying(false)}
        onError={() => setError("Preview unavailable")}
      />
      <div className="flex items-center gap-4">
        <button
          onClick={toggle}
          disabled={!!error}
          aria-label={playing ? "Pause preview" : "Play preview"}
          className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition hover:scale-105 disabled:opacity-50"
        >
          {playing ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
        </button>
        <div className="flex-1 space-y-1.5">
          <input
            type="range"
            min={0}
            max={100}
            value={duration ? (current / duration) * 100 : 0}
            onChange={seek}
            className="h-1 w-full cursor-pointer appearance-none rounded-full bg-secondary accent-primary"
          />
          <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
            <span>{fmt(current)}</span>
            <span>{fmt(duration)}</span>
          </div>
        </div>
      </div>
      {error && (
        <div className="mt-3 flex items-center gap-2 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}