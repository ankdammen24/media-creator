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
import { logPlaybackEvent } from "@/lib/stats.functions";

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

/** How many seconds before a track ends we kick off the next (already preloaded) track. */
const GAP_FILL_SEC = 0.8;

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
  // Track id whose automatic end-of-track handoff has already started,
  // so the timeupdate handler only triggers it once.
  const handoffGuardRef = useRef<string | null>(null);
  // Preloaded next track sitting silent on the inactive deck.
  const preloadedRef = useRef<{ trackId: string; url: string } | null>(null);
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
  // Cache signed URLs per trackId so we don't re-sign the same file unnecessarily.
  const signedUrlCacheRef = useRef<Map<string, { signedUrl: string; expiresAt: number }>>(new Map());
  // Anonymous browser session id, used to dedupe and rate-limit events.
  const sessionIdRef = useRef<string>("");
  // Pending 30s "completed" timer + tracked submission id.
  const completedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completedTrackIdRef = useRef<string | null>(null);
  // Submissions for which we already counted a completed_30s today (session).
  const completedSentRef = useRef<Set<string>>(new Set());
  // Submissions for which we already counted a "play" this session.
  const playSentRef = useRef<Set<string>>(new Set());
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

  // Initialize a stable per-browser session id (used as anonymous dedupe key).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const KEY = "mr-playback-session";
    let id = window.sessionStorage.getItem(KEY);
    if (!id) {
      id = (typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
      try { window.sessionStorage.setItem(KEY, id); } catch { /* ignore */ }
    }
    sessionIdRef.current = id;
  }, []);

  // Fire-and-forget event log. Failures are silent — analytics must never
  // block playback or surface errors to the listener.
  const fireEvent = useCallback(
    (submissionId: string, eventType: "play" | "completed_30s") => {
      const sessionId = sessionIdRef.current || undefined;
      void logPlaybackEvent({
        data: { submissionId, eventType, source: "player", sessionId },
      }).catch(() => undefined);
    },
    [],
  );

  const clearCompletedTimer = useCallback(() => {
    if (completedTimerRef.current) {
      clearTimeout(completedTimerRef.current);
      completedTimerRef.current = null;
    }
    completedTrackIdRef.current = null;
  }, []);

  // The element currently driving playback + UI.
  const getActive = useCallback(
    () => decksRef.current[activeIdxRef.current] ?? null,
    [],
  );

  // Stable ref to the crossfade entry point so once-bound listeners can call it.
  const goToTrackRef = useRef<
    | ((
        track: PlayerTrack,
        opts?: { keepQueue?: boolean },
      ) => Promise<void>)
    | null
  >(null);

  // Clear whatever is preloaded on the inactive deck.
  const clearPreload = useCallback(() => {
    preloadedRef.current = null;
    const inactive = decksRef.current[activeIdxRef.current ^ 1];
    if (inactive) {
      inactive.pause();
      inactive.removeAttribute("src");
      try { inactive.load(); } catch { /* ignore */ }
    }
  }, []);

  // Stable ref to the preload-next entry point so the gap-fill handler can
  // re-trigger preloading after it has handed off to the next track.
  const preloadNextRef = useRef<(() => Promise<void>) | null>(null);

  // Arm the play + 30s "completed" tracking for a track that has just been
  // promoted to the active deck (used by goToTrack and the gap-fill handoff).
  const armTrackTracking = useCallback(
    (track: PlayerTrack) => {
      clearCompletedTimer();
      if (!playSentRef.current.has(track.id)) {
        playSentRef.current.add(track.id);
        fireEvent(track.id, "play");
      }
      const targetId = track.id;
      completedTrackIdRef.current = targetId;
      completedTimerRef.current = setTimeout(() => {
        const el = decksRef.current[activeIdxRef.current];
        if (
          completedTrackIdRef.current === targetId &&
          currentRef.current?.id === targetId &&
          el &&
          !el.paused &&
          !completedSentRef.current.has(targetId)
        ) {
          completedSentRef.current.add(targetId);
          fireEvent(targetId, "completed_30s");
        }
      }, 30_000);
    },
    [clearCompletedTimer, fireEvent],
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
      // The gap-fill handoff normally advances before "ended"; this handles
      // the tail (last track, podcasts, or very short tracks).
      const next = queueRef.current[0];
      if (next) {
        const prev = currentRef.current;
        if (prev) setHistory((h) => [...h, prev]);
        setQueue((q) => q.slice(1));
        void goToTrackRef.current?.(next, { keepQueue: true });
      }
    };

    // When the active track is within GAP_FILL_SEC of its end, start the
    // preloaded next track on the inactive deck and swap. No volume ramp —
    // both decks just briefly overlap to cover the silent gap.
    function maybeAutoCrossfade() {
      const el = getActive();
      const cur = currentRef.current;
      if (!el || !cur || cur.mediaType !== "music") return;
      if (!el.duration || !isFinite(el.duration)) return;
      if (el.duration - el.currentTime > GAP_FILL_SEC) return;
      const next = queueRef.current[0];
      if (!next || next.mediaType !== "music") return;
      if (handoffGuardRef.current === cur.id) return;
      const pre = preloadedRef.current;
      const inactive = decksRef.current[activeIdxRef.current ^ 1];
      if (!pre || pre.trackId !== next.id || !inactive) return;
      handoffGuardRef.current = cur.id;
      // Swap decks: the preloaded inactive becomes the new active driver.
      const oldActive = el;
      activeIdxRef.current = activeIdxRef.current ^ 1;
      setHistory((h) => [...h, cur]);
      setQueue((q) => q.slice(1));
      setCurrent(next);
      setProgress(0);
      setDuration(inactive.duration || 0);
      inactive.play().catch(() => undefined);
      // Pause the outgoing deck shortly after to give the listener ~0.8s of
      // overlap that hides the silent gap at the end of the previous file.
      window.setTimeout(() => {
        if (oldActive && !oldActive.paused) oldActive.pause();
      }, GAP_FILL_SEC * 1000);
      preloadedRef.current = null;
      // Reset play + 30s tracking for the new active track and start
      // preloading whatever is next.
      armTrackTracking(next);
      void preloadNextRef.current?.();
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
  // smaller AAC/M4A web variant when available. Reuses cached URLs when
  // they haven't expired yet.
  const signedUrlFor = useCallback(async (track: PlayerTrack) => {
    const playbackPath = track.webAudioPath || track.audioPath;
    const cacheKey = `${track.id}:${playbackPath}`;
    const cached = signedUrlCacheRef.current.get(cacheKey);
    const now = Date.now();
    // Reuse cached URL if it still has at least 5 minutes of life left.
    if (cached && cached.expiresAt > now + 5 * 60 * 1000) {
      return cached.signedUrl;
    }
    const { data, error } = await supabase.storage
      .from("audio")
      .createSignedUrl(playbackPath, 3600);
    if (error || !data) return null;
    signedUrlCacheRef.current.set(cacheKey, {
      signedUrl: data.signedUrl,
      expiresAt: now + 3600 * 1000,
    });
    return data.signedUrl;
  }, []);

  // Core transition. With useCrossfade we fade between two decks; otherwise we
  // hard-switch on the active deck. Crossfade only applies music→music while
  // something is already playing.
  const goToTrack = useCallback(
    async (
      track: PlayerTrack,
      opts?: { keepQueue?: boolean },
    ) => {
      const decks = decksRef.current;
      if (decks.length < 2) return;
      const fromIdx = activeIdxRef.current;
      const fromEl = decks[fromIdx];
      const toEl = decks[fromIdx ^ 1];

      const url = await signedUrlFor(track);
      if (!url) return;

      if (!opts?.keepQueue) {
        void buildRandomQueue(track.id);
        setHistory([]);
      }

      setIsLoading(true);
      setProgress(0);
      setDuration(0);
      handoffGuardRef.current = null;
      // New track replacing the old one — anything preloaded for the
      // previous "next" is now stale.
      clearPreload();

      // Reset the 30s completion timer for the new active track.
      armTrackTracking(track);

      // Hard switch on the active deck; stop the other deck.
      toEl.pause();
      toEl.removeAttribute("src");
      try { toEl.load(); } catch { /* ignore */ }
      preloadedRef.current = null;
      fromEl.volume = 1;
      fromEl.src = url;
      setCurrent(track);
      try {
        await fromEl.play();
      } catch {
        setIsLoading(false);
      }
      // Kick off preloading of whatever is currently next in the queue.
      void preloadNextRef.current?.();
    },
    [buildRandomQueue, signedUrlFor, clearPreload, armTrackTracking],
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
      await goToTrack(track, { keepQueue: opts?.keepQueue });
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
      void goToTrack(first, { keepQueue: true });
    },
    [goToTrack],
  );

  const skipNext = useCallback(() => {
    const next = queueRef.current[0];
    if (!next) return;
    const prev = currentRef.current;
    if (prev) setHistory((h) => [...h, prev]);
    setQueue((q) => q.slice(1));
    void goToTrack(next, { keepQueue: true });
  }, [goToTrack]);

  const skipPrev = useCallback(() => {
    const hist = historyRef.current;
    if (hist.length === 0) return;
    const prev = hist[hist.length - 1];
    const cur = currentRef.current;
    setHistory((h) => h.slice(0, -1));
    if (cur) setQueue((q) => [cur, ...q]);
    void goToTrack(prev, { keepQueue: true });
  }, [goToTrack]);

  const toggle = useCallback(() => {
    const el = getActive();
    if (!el || !current) return;
    if (el.paused) {
      el.play().catch(() => {});
    } else {
      el.pause();
    }
  }, [getActive, current]);

  const seek = useCallback((seconds: number) => {
    const el = getActive();
    if (!el) return;
    el.currentTime = Math.max(0, Math.min(seconds, el.duration || seconds));
  }, [getActive]);

  const close = useCallback(() => {
    clearPreload();
    for (const el of decksRef.current) {
      el.pause();
      el.removeAttribute("src");
      el.volume = 1;
      el.load();
    }
    handoffGuardRef.current = null;
    setCurrent(null);
    setIsPlaying(false);
    setProgress(0);
    setDuration(0);
    setQueue([]);
    setHistory([]);
  }, [clearPreload]);

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