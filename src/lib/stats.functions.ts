import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// ---------- logPlaybackEvent ----------
// Open to anonymous callers (anyone can press Play). We validate that the
// submission exists and is approved before writing, and we write through
// service_role since the table has no anon/authenticated policies.
const LogInput = z.object({
  submissionId: z.string().uuid(),
  eventType: z.enum(["play", "completed_30s"]),
  source: z
    .enum(["catalog", "album_page", "artist_page", "player", "other"])
    .optional()
    .default("other"),
  sessionId: z.string().min(1).max(64).optional(),
});

export const logPlaybackEvent = createServerFn({ method: "POST" })
  .inputValidator((input) => LogInput.parse(input))
  .handler(async ({ data }) => {
    const { data: sub, error: subErr } = await supabaseAdmin
      .from("submissions")
      .select("id, status, user_id")
      .eq("id", data.submissionId)
      .maybeSingle();
    if (subErr) throw new Error(`submission lookup: ${subErr.message}`);
    if (!sub || sub.status !== "approved") {
      // Silently ignore — don't leak existence info to the client.
      return { ok: true, ignored: true };
    }

    const { error } = await supabaseAdmin.from("playback_events" as never).insert({
      submission_id: data.submissionId,
      event_type: data.eventType,
      source: data.source,
      session_id: data.sessionId ?? null,
    } as never);
    if (error) throw new Error(`log event: ${error.message}`);
    return { ok: true };
  });

// ---------- getArtistStats ----------
export type ArtistStatRow = {
  submissionId: string;
  title: string;
  mediaType: "music" | "podcast";
  albumTitle: string | null;
  playCount: number;
  completedCount: number;
  radioSpinCount: number;
  lastPlayedAt: string | null;
};

export type ArtistStatsResult = {
  totals: {
    play: number;
    completed: number;
    radio: number;
    play30d: number;
    completed30d: number;
    radio30d: number;
  };
  rows: ArtistStatRow[];
};

const StatsInput = z.object({
  artistProfileId: z.string().uuid().optional(),
});

export const getArtistStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => StatsInput.parse(input))
  .handler(async ({ data, context }): Promise<ArtistStatsResult> => {
    const { userId } = context;

    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    const isAdmin = !!roleRow;

    // Restrict to the requesting user's artist(s) unless admin.
    let artistQ = supabaseAdmin.from("artist_profiles").select("id, user_id");
    if (data.artistProfileId) artistQ = artistQ.eq("id", data.artistProfileId);
    if (!isAdmin) artistQ = artistQ.eq("user_id", userId);
    const { data: artists, error: artistErr } = await artistQ;
    if (artistErr) throw new Error(`artist lookup: ${artistErr.message}`);
    const artistIds = (artists ?? []).map((a) => a.id);
    if (artistIds.length === 0) return { totals: emptyTotals(), rows: [] };

    const { data: subs, error: subsErr } = await supabaseAdmin
      .from("submissions")
      .select("id, title, media_type, status, album_id, albums(title)")
      .in("artist_profile_id", artistIds)
      .eq("status", "approved");
    if (subsErr) throw new Error(`submissions lookup: ${subsErr.message}`);
    const submissionList = (subs ?? []) as Array<{
      id: string;
      title: string;
      media_type: "music" | "podcast";
      album_id: string | null;
      albums: { title: string } | { title: string }[] | null;
    }>;
    if (submissionList.length === 0) return { totals: emptyTotals(), rows: [] };
    const subIds = submissionList.map((s) => s.id);

    // Pull all events for these submissions. For realistic catalog sizes this
    // is fine; if it grows huge we can materialize an aggregate table later.
    const events: Array<{
      submission_id: string;
      event_type: "play" | "completed_30s" | "radio_spin";
      occurred_at: string;
    }> = [];
    const PAGE = 1000;
    let from = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data: page, error } = await supabaseAdmin
        .from("playback_events" as never)
        .select("submission_id, event_type, occurred_at")
        .in("submission_id", subIds)
        .order("occurred_at", { ascending: false })
        .range(from, from + PAGE - 1);
      if (error) throw new Error(`events lookup: ${error.message}`);
      const rows = (page ?? []) as typeof events;
      events.push(...rows);
      if (rows.length < PAGE) break;
      from += PAGE;
    }

    const cutoff30 = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const totals = emptyTotals();
    const perSub = new Map<
      string,
      { play: number; completed: number; radio: number; last: string | null }
    >();
    for (const id of subIds) {
      perSub.set(id, { play: 0, completed: 0, radio: 0, last: null });
    }
    for (const ev of events) {
      const bucket = perSub.get(ev.submission_id);
      if (!bucket) continue;
      const recent = new Date(ev.occurred_at).getTime() >= cutoff30;
      if (ev.event_type === "play") {
        bucket.play += 1;
        totals.play += 1;
        if (recent) totals.play30d += 1;
      } else if (ev.event_type === "completed_30s") {
        bucket.completed += 1;
        totals.completed += 1;
        if (recent) totals.completed30d += 1;
      } else if (ev.event_type === "radio_spin") {
        bucket.radio += 1;
        totals.radio += 1;
        if (recent) totals.radio30d += 1;
      }
      if (!bucket.last || ev.occurred_at > bucket.last) bucket.last = ev.occurred_at;
    }

    const rows: ArtistStatRow[] = submissionList
      .map((s) => {
        const b = perSub.get(s.id)!;
        const album = Array.isArray(s.albums) ? s.albums[0] : s.albums;
        return {
          submissionId: s.id,
          title: s.title,
          mediaType: s.media_type,
          albumTitle: album?.title ?? null,
          playCount: b.play,
          completedCount: b.completed,
          radioSpinCount: b.radio,
          lastPlayedAt: b.last,
        };
      })
      .sort(
        (a, b) =>
          b.playCount + b.radioSpinCount - (a.playCount + a.radioSpinCount),
      );

    return { totals, rows };
  });

function emptyTotals() {
  return { play: 0, completed: 0, radio: 0, play30d: 0, completed30d: 0, radio30d: 0 };
}