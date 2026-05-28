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
import { useAuth } from "@/lib/auth";

export type PlayerTrack = {
  id: string;
  title: string;
  artist: string | null;
  artistId: string | null;
  artworkPath: string;
  audioPath: string;
  /** Optional smaller AAC/M4A web variant; preferred for playback when present. */
  webAudioPath?: string | null;
  mediaType: "music" | "podcast";
};

type PlayerContextValue = {
  current: PlayerTrack | null;
  isPlaying: boolean;
  isLoading: boolean;
  progress: number;
  duration: number;
  play: (track: PlayerTrack) => void;
  playQueue: (tracks: PlayerTrack[], startIndex?: number) => void;
  toggle: () => void;
  seek: (seconds: number) => void;
  close: () => void;
  skipNext: () => void;
  skipPrev: () => void;
  hasNext: boolean;
  hasPrev: boolean;
};

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within PlayerProvider");
  return ctx;
}

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [current, setCurrent] = useState<PlayerTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [queue, setQueue] = useState<PlayerTrack[]>([]);
  const [history, setHistory] = useState<PlayerTrack[]>([]);
  // Refs let event handlers read current values without re-binding listeners
  const queueRef = useRef<PlayerTrack[]>([]);
  const historyRef = useRef<PlayerTrack[]>([]);
  const currentRef = useRef<PlayerTrack | null>(null);
  const userRef = useRef(user);
  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);
  useEffect(() => {
    historyRef.current = history;
  }, [history]);
  useEffect(() => {
    currentRef.current = current;
  }, [current]);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

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
    const onEnded = () => {
      setIsPlaying(false);
      // Auto-advance from the anon random queue
      const next = queueRef.current[0];
      if (next) {
        const prev = currentRef.current;
        if (prev) setHistory((h) => [...h, prev]);
        setQueue((q) => q.slice(1));
        // Defer to next tick so React state settles before play()
        void playTrackRef.current?.(next, { keepQueue: true });
      }
    };

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

  const playTrackRef = useRef<
    ((track: PlayerTrack, opts?: { keepQueue?: boolean }) => Promise<void>) | null
  >(null);

  // Fetch a random shuffled queue of approved music tracks to auto-play next.
  const buildRandomQueue = useCallback(async (excludeId: string) => {
    // Pull up to ~80 most-recent approved music tracks, then shuffle client-side.
    const { data, error } = await supabase
      .from("submissions")
      .select(
        "id, title, artwork_path, audio_path, audio_web_path, media_type, artist_profiles!submissions_artist_profile_id_fkey(id, name), albums(artwork_path)",
      )
      .eq("status", "approved")
      .eq("media_type", "music")
      .order("created_at", { ascending: false })
      .limit(80);
    if (error || !data) return;
    type Row = {
      id: string;
      title: string;
      artwork_path: string;
      audio_path: string;
      audio_web_path: string | null;
      media_type: "music" | "podcast";
      artist_profiles: { id: string; name: string } | null;
      albums: { artwork_path: string | null } | null;
    };
    const tracks: PlayerTrack[] = (data as unknown as Row[])
      .filter((r) => r.id !== excludeId)
      .map((r) => ({
        id: r.id,
        title: r.title,
        artist: r.artist_profiles?.name ?? null,
        artistId: r.artist_profiles?.id ?? null,
        artworkPath: r.albums?.artwork_path ?? r.artwork_path,
        audioPath: r.audio_path,
        webAudioPath: r.audio_web_path,
        mediaType: r.media_type,
      }));
    // Fisher–Yates shuffle
    for (let i = tracks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
    }
    setQueue(tracks);
  }, []);

  const play = useCallback(async (track: PlayerTrack, opts?: { keepQueue?: boolean }) => {
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
    // Always queue up a random shuffled set of approved music tracks so the
    // player keeps going after the current track ends.
    if (!opts?.keepQueue) {
      void buildRandomQueue(track.id);
      setHistory([]);
    }
    // Prefer the smaller AAC/M4A web variant when available — falls back
    // to the original upload for tracks that haven't been processed yet.
    const playbackPath = track.webAudioPath || track.audioPath;
    const { data, error } = await supabase.storage
      .from("audio")
      .createSignedUrl(playbackPath, 3600);
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
  }, [current?.id, buildRandomQueue]);

  useEffect(() => {
    playTrackRef.current = play;
  }, [play]);

  const playQueue = useCallback(
    (tracks: PlayerTrack[], startIndex = 0) => {
      if (tracks.length === 0) return;
      const idx = Math.max(0, Math.min(startIndex, tracks.length - 1));
      const first = tracks[idx];
      const rest = tracks.slice(idx + 1);
      const before = tracks.slice(0, idx);
      setHistory(before);
      setQueue(rest);
      void play(first, { keepQueue: true });
    },
    [play],
  );

  const skipNext = useCallback(() => {
    const next = queueRef.current[0];
    if (!next) return;
    const prev = currentRef.current;
    if (prev) setHistory((h) => [...h, prev]);
    setQueue((q) => q.slice(1));
    void play(next, { keepQueue: true });
  }, [play]);

  const skipPrev = useCallback(() => {
    const hist = historyRef.current;
    if (hist.length === 0) return;
    const prev = hist[hist.length - 1];
    const cur = currentRef.current;
    setHistory((h) => h.slice(0, -1));
    if (cur) setQueue((q) => [cur, ...q]);
    void play(prev, { keepQueue: true });
  }, [play]);

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
    setQueue([]);
    setHistory([]);
  }, []);

  const value = useMemo<PlayerContextValue>(
    () => ({
      current,
      isPlaying,
      isLoading,
      progress,
      duration,
      play,
      playQueue,
      toggle,
      seek,
      close,
      skipNext,
      skipPrev,
      hasNext: queue.length > 0,
      hasPrev: history.length > 0,
    }),
    [current, isPlaying, isLoading, progress, duration, play, playQueue, toggle, seek, close, skipNext, skipPrev, queue.length, history.length],
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}