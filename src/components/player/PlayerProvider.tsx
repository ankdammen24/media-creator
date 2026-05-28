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

/** Crossfade length between music tracks. */
const CROSSFADE_SEC = 2.5;
const CROSSFADE_MS = CROSSFADE_SEC * 1000;

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within PlayerProvider");
  return ctx;
}

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  // Two "decks" so we can crossfade one track out while the next fades in.
  const decksRef = useRef<HTMLAudioElement[]>([]);
  const activeIdxRef = useRef(0);
  const fadeRafRef = useRef<number | null>(null);
  const fadingOutElRef = useRef<HTMLAudioElement | null>(null);
  // Track id whose automatic end-of-track crossfade has already started,
  // so the timeupdate handler only triggers it once.
  const fadeGuardRef = useRef<string | null>(null);
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

  // The element currently driving playback + UI.
  const getActive = useCallback(
    () => decksRef.current[activeIdxRef.current] ?? null,
    [],
  );

  // Stable ref to the crossfade entry point so once-bound listeners can call it.
  const goToTrackRef = useRef<
    | ((
        track: PlayerTrack,
        opts?: { keepQueue?: boolean; useCrossfade?: boolean },
      ) => Promise<void>)
    | null
  >(null);

  // Cancel any in-flight volume ramp and silence/stop the fading-out deck.
  const cancelFade = useCallback(() => {
    if (fadeRafRef.current !== null) {
      cancelAnimationFrame(fadeRafRef.current);
      fadeRafRef.current = null;
    }
    const fo = fadingOutElRef.current;
    if (fo) {
      fo.pause();
      fo.volume = 1;
      fadingOutElRef.current = null;
    }
  }, []);

  // Linear 2.5s volume ramp: fromEl 1→0, toEl 0→1.
  const startFade = useCallback(
    (fromEl: HTMLAudioElement, toEl: HTMLAudioElement) => {
      const start = performance.now();
      const fromStart = fromEl.volume;
      fadingOutElRef.current = fromEl;
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / CROSSFADE_MS);
        fromEl.volume = Math.max(0, fromStart * (1 - t));
        toEl.volume = Math.min(1, t);
        if (t < 1) {
          fadeRafRef.current = requestAnimationFrame(step);
        } else {
          fromEl.pause();
          fromEl.volume = 1; // reset so it can be reused as the next incoming deck
          fadingOutElRef.current = null;
          fadeRafRef.current = null;
        }
      };
      fadeRafRef.current = requestAnimationFrame(step);
    },
    [],
  );

  // Create two audio elements on mount (client only).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const a = new Audio();
    const b = new Audio();
    a.preload = "metadata";
    b.preload = "metadata";
    a.volume = 1;
    b.volume = 1;
    decksRef.current = [a, b];
    activeIdxRef.current = 0;

    const isActive = (target: EventTarget | null) => target === getActive();

    const onPlay = (e: Event) => {
      if (isActive(e.target)) setIsPlaying(true);
    };
    const onPause = (e: Event) => {
      if (isActive(e.target)) setIsPlaying(false);
    };
    const onTime = (e: Event) => {
      if (!isActive(e.target)) return;
      const el = getActive();
      if (!el) return;
      setProgress(el.currentTime);
      maybeAutoCrossfade();
    };
    const onMeta = (e: Event) => {
      if (isActive(e.target)) setDuration((e.target as HTMLAudioElement).duration || 0);
    };
    const onWaiting = (e: Event) => {
      if (isActive(e.target)) setIsLoading(true);
    };
    const onPlaying = (e: Event) => {
      if (isActive(e.target)) setIsLoading(false);
    };
    const onEnded = (e: Event) => {
      if (!isActive(e.target)) return;
      setIsPlaying(false);
      // Crossfade normally advances before "ended"; this handles the tail
      // (last track, podcasts, or tracks shorter than the crossfade).
      const next = queueRef.current[0];
      if (next) {
        const prev = currentRef.current;
        if (prev) setHistory((h) => [...h, prev]);
        setQueue((q) => q.slice(1));
        void goToTrackRef.current?.(next, { keepQueue: true, useCrossfade: false });
      }
    };

    // When the active track nears its end, begin crossfading to the next
    // music track in the queue.
    function maybeAutoCrossfade() {
      const el = getActive();
      const cur = currentRef.current;
      if (!el || !cur || cur.mediaType !== "music") return;
      if (!el.duration || !isFinite(el.duration)) return;
      if (el.duration - el.currentTime > CROSSFADE_SEC) return;
      const next = queueRef.current[0];
      if (!next || next.mediaType !== "music") return;
      if (fadeGuardRef.current === cur.id) return;
      fadeGuardRef.current = cur.id;
      setHistory((h) => [...h, cur]);
      setQueue((q) => q.slice(1));
      void goToTrackRef.current?.(next, { keepQueue: true, useCrossfade: true });
    }

    for (const el of [a, b]) {
      el.addEventListener("play", onPlay);
      el.addEventListener("pause", onPause);
      el.addEventListener("timeupdate", onTime);
      el.addEventListener("loadedmetadata", onMeta);
      el.addEventListener("waiting", onWaiting);
      el.addEventListener("playing", onPlaying);
      el.addEventListener("ended", onEnded);
    }

    return () => {
      if (fadeRafRef.current !== null) cancelAnimationFrame(fadeRafRef.current);
      for (const el of [a, b]) {
        el.pause();
        el.removeEventListener("play", onPlay);
        el.removeEventListener("pause", onPause);
        el.removeEventListener("timeupdate", onTime);
        el.removeEventListener("loadedmetadata", onMeta);
        el.removeEventListener("waiting", onWaiting);
        el.removeEventListener("playing", onPlaying);
        el.removeEventListener("ended", onEnded);
      }
      decksRef.current = [];
    };
  }, [getActive]);

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

  // Resolve a short-lived signed URL for a track's audio file. Prefers the
  // smaller AAC/M4A web variant when available.
  const signedUrlFor = useCallback(async (track: PlayerTrack) => {
    const playbackPath = track.webAudioPath || track.audioPath;
    const { data, error } = await supabase.storage
      .from("audio")
      .createSignedUrl(playbackPath, 3600);
    if (error || !data) return null;
    return data.signedUrl;
  }, []);

  // Core transition. With useCrossfade we fade between two decks; otherwise we
  // hard-switch on the active deck. Crossfade only applies music→music while
  // something is already playing.
  const goToTrack = useCallback(
    async (
      track: PlayerTrack,
      opts?: { keepQueue?: boolean; useCrossfade?: boolean },
    ) => {
      const decks = decksRef.current;
      if (decks.length < 2) return;
      const fromIdx = activeIdxRef.current;
      const fromEl = decks[fromIdx];
      const toEl = decks[fromIdx ^ 1];
      const fromTrack = currentRef.current;

      const crossfade =
        !!opts?.useCrossfade &&
        track.mediaType === "music" &&
        fromTrack?.mediaType === "music" &&
        !fromEl.paused;

      const url = await signedUrlFor(track);
      if (!url) return;

      if (!opts?.keepQueue) {
        void buildRandomQueue(track.id);
        setHistory([]);
      }

      setIsLoading(true);
      setProgress(0);
      setDuration(0);
      fadeGuardRef.current = null;

      if (!crossfade) {
        // Hard switch on the active deck; stop the other deck + any fade.
        cancelFade();
        toEl.pause();
        fromEl.volume = 1;
        fromEl.src = url;
        setCurrent(track);
        try {
          await fromEl.play();
        } catch {
          setIsLoading(false);
        }
        return;
      }

      // Crossfade: start the inactive deck silent, make it active, ramp.
      cancelFade();
      toEl.src = url;
      toEl.volume = 0;
      activeIdxRef.current = fromIdx ^ 1;
      setCurrent(track);
      try {
        await toEl.play();
      } catch {
        setIsLoading(false);
      }
      startFade(fromEl, toEl);
    },
    [buildRandomQueue, signedUrlFor, cancelFade, startFade],
  );

  useEffect(() => {
    goToTrackRef.current = goToTrack;
  }, [goToTrack]);

  // Public play: toggles the active deck for the same track, otherwise
  // hard-switches and rebuilds the random queue.
  const play = useCallback(
    async (track: PlayerTrack, opts?: { keepQueue?: boolean }) => {
      const el = getActive();
      if (!el) return;
      if (currentRef.current?.id === track.id) {
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
      await goToTrack(track, { keepQueue: opts?.keepQueue, useCrossfade: false });
    },
    [getActive, goToTrack],
  );

  const playQueue = useCallback(
    (tracks: PlayerTrack[], startIndex = 0) => {
      if (tracks.length === 0) return;
      const idx = Math.max(0, Math.min(startIndex, tracks.length - 1));
      const first = tracks[idx];
      const rest = tracks.slice(idx + 1);
      const before = tracks.slice(0, idx);
      setHistory(before);
      setQueue(rest);
      void goToTrack(first, { keepQueue: true, useCrossfade: false });
    },
    [goToTrack],
  );

  const skipNext = useCallback(() => {
    const next = queueRef.current[0];
    if (!next) return;
    const prev = currentRef.current;
    if (prev) setHistory((h) => [...h, prev]);
    setQueue((q) => q.slice(1));
    void goToTrack(next, { keepQueue: true, useCrossfade: true });
  }, [goToTrack]);

  const skipPrev = useCallback(() => {
    const hist = historyRef.current;
    if (hist.length === 0) return;
    const prev = hist[hist.length - 1];
    const cur = currentRef.current;
    setHistory((h) => h.slice(0, -1));
    if (cur) setQueue((q) => [cur, ...q]);
    void goToTrack(prev, { keepQueue: true, useCrossfade: true });
  }, [goToTrack]);

  const toggle = useCallback(() => {
    const el = getActive();
    if (!el || !current) return;
    if (el.paused) {
      el.play().catch(() => {});
    } else {
      el.pause();
      // If a crossfade is mid-flight, pause the outgoing deck too.
      fadingOutElRef.current?.pause();
    }
  }, [getActive, current]);

  const seek = useCallback((seconds: number) => {
    const el = getActive();
    if (!el) return;
    el.currentTime = Math.max(0, Math.min(seconds, el.duration || seconds));
  }, [getActive]);

  const close = useCallback(() => {
    cancelFade();
    for (const el of decksRef.current) {
      el.pause();
      el.removeAttribute("src");
      el.volume = 1;
      el.load();
    }
    fadeGuardRef.current = null;
    setCurrent(null);
    setIsPlaying(false);
    setProgress(0);
    setDuration(0);
    setQueue([]);
    setHistory([]);
  }, [cancelFade]);

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