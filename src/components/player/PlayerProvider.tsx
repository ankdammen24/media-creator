import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { supabase } from "@/integrations/supabase/client";

export type PlayerTrack = {
  id: string;
  title: string;
  artist: string | null;
  artistId: string | null;
  artworkPath: string;
  audioPath: string;
  mediaType: "music" | "podcast";
};

type PlayerContextValue = {
  current: PlayerTrack | null;
  isPlaying: boolean;
  isLoading: boolean;
  progress: number;
  duration: number;
  play: (track: PlayerTrack) => void;
  toggle: () => void;
  seek: (seconds: number) => void;
  close: () => void;
};

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within PlayerProvider");
  return ctx;
}

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [current, setCurrent] = useState<PlayerTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  // Create a single audio element on mount (client only)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const el = new Audio();
    el.preload = "metadata";
    audioRef.current = el;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onTime = () => setProgress(el.currentTime);
    const onMeta = () => setDuration(el.duration || 0);
    const onWaiting = () => setIsLoading(true);
    const onPlaying = () => setIsLoading(false);
    const onEnded = () => setIsPlaying(false);

    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("loadedmetadata", onMeta);
    el.addEventListener("waiting", onWaiting);
    el.addEventListener("playing", onPlaying);
    el.addEventListener("ended", onEnded);

    return () => {
      el.pause();
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("loadedmetadata", onMeta);
      el.removeEventListener("waiting", onWaiting);
      el.removeEventListener("playing", onPlaying);
      el.removeEventListener("ended", onEnded);
      audioRef.current = null;
    };
  }, []);

  const play = useCallback(async (track: PlayerTrack) => {
    const el = audioRef.current;
    if (!el) return;
    if (current?.id === track.id) {
      if (el.paused) {
        try {
          await el.play();
        } catch {
          /* user gesture issue, ignore */
        }
      } else {
        el.pause();
      }
      return;
    }
    setCurrent(track);
    setIsLoading(true);
    setProgress(0);
    setDuration(0);
    const { data, error } = await supabase.storage
      .from("audio")
      .createSignedUrl(track.audioPath, 3600);
    if (error || !data) {
      setIsLoading(false);
      return;
    }
    el.src = data.signedUrl;
    try {
      await el.play();
    } catch {
      setIsLoading(false);
    }
  }, [current?.id]);

  const toggle = useCallback(() => {
    const el = audioRef.current;
    if (!el || !current) return;
    if (el.paused) el.play().catch(() => {});
    else el.pause();
  }, [current]);

  const seek = useCallback((seconds: number) => {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = Math.max(0, Math.min(seconds, el.duration || seconds));
  }, []);

  const close = useCallback(() => {
    const el = audioRef.current;
    if (el) {
      el.pause();
      el.removeAttribute("src");
      el.load();
    }
    setCurrent(null);
    setIsPlaying(false);
    setProgress(0);
    setDuration(0);
  }, []);

  const value = useMemo<PlayerContextValue>(
    () => ({ current, isPlaying, isLoading, progress, duration, play, toggle, seek, close }),
    [current, isPlaying, isLoading, progress, duration, play, toggle, seek, close],
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}