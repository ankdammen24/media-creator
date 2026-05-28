import * as XLSX from "xlsx";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type ParsedRow = {
  sheet_name: string;
  row_index: number;
  artist_name_raw: string | null;
  album_title_raw: string | null;
  track_title_raw: string | null;
  upc_raw: string | null;
  isrc_raw: string | null;
};

const UPC_RE = /^\s*UPC\s*[:#]?\s*([0-9A-Za-z-]+)\s*$/i;

function norm(s: string | null | undefined): string {
  return (s ?? "")
    .toString()
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Parse the xlsx file format used by the catalog: each sheet is an artist
 * (sheet name = artist name). Inside the sheet, blocks are separated by
 * blank rows. First non-empty cell in a block is the album title, a row
 * "UPC: <code>" gives the album UPC, and subsequent rows are
 * "<track title>: <ISRC>" pairs.
 */
export function parseWorkbook(bytes: Uint8Array): ParsedRow[] {
  const wb = XLSX.read(bytes, { type: "array" });
  const rows: ParsedRow[] = [];

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      blankrows: true,
      defval: null,
    });

    // collapse each row to first non-empty cell text (col A or B)
    const lines: Array<{ idx: number; text: string | null }> = aoa.map((r, i) => {
      const cells = (r ?? []) as unknown[];
      let val: string | null = null;
      for (const c of cells) {
        if (c == null) continue;
        const s = String(c).trim();
        if (s.length === 0) continue;
        val = s;
        break;
      }
      return { idx: i + 1, text: val };
    });

    let albumTitle: string | null = null;
    let albumUpc: string | null = null;
    let albumLineIdx = 0;
    let inBlockHeader = true; // expecting title then UPC

    const flushAlbumRow = () => {
      if (albumTitle) {
        rows.push({
          sheet_name: sheetName,
          row_index: albumLineIdx,
          artist_name_raw: sheetName,
          album_title_raw: albumTitle,
          track_title_raw: null,
          upc_raw: albumUpc,
          isrc_raw: null,
        });
      }
    };

    let albumEmitted = false;

    for (let i = 0; i < lines.length; i++) {
      const { idx, text } = lines[i];
      // Skip the very first row if it equals the sheet name (artist header)
      if (i === 0 && text && norm(text) === norm(sheetName)) continue;

      if (!text) {
        // blank row → end of block
        if (albumTitle && !albumEmitted) {
          flushAlbumRow();
          albumEmitted = true;
        }
        albumTitle = null;
        albumUpc = null;
        inBlockHeader = true;
        albumEmitted = false;
        continue;
      }

      if (inBlockHeader) {
        if (!albumTitle) {
          albumTitle = text;
          albumLineIdx = idx;
          continue;
        }
        // second header line - look for UPC
        const m = text.match(UPC_RE);
        if (m) {
          albumUpc = m[1];
          continue;
        }
        // No UPC line — treat as track immediately
        inBlockHeader = false;
        // fall through to track parsing
      }

      // tracks
      if (!albumEmitted) {
        flushAlbumRow();
        albumEmitted = true;
      }
      const m2 = text.match(UPC_RE);
      if (m2) {
        // late UPC row — attach to album by upserting later
        rows.push({
          sheet_name: sheetName,
          row_index: idx,
          artist_name_raw: sheetName,
          album_title_raw: albumTitle,
          track_title_raw: null,
          upc_raw: m2[1],
          isrc_raw: null,
        });
        continue;
      }
      // Split on LAST ':' to get title + ISRC
      const lastColon = text.lastIndexOf(":");
      let title = text;
      let isrc: string | null = null;
      if (lastColon >= 0) {
        const maybeIsrc = text.slice(lastColon + 1).trim();
        if (/^[A-Z0-9-]{6,20}$/i.test(maybeIsrc)) {
          isrc = maybeIsrc.toUpperCase();
          title = text.slice(0, lastColon).trim();
        }
      }
      rows.push({
        sheet_name: sheetName,
        row_index: idx,
        artist_name_raw: sheetName,
        album_title_raw: albumTitle,
        track_title_raw: title,
        upc_raw: null,
        isrc_raw: isrc,
      });
      inBlockHeader = false;
    }

    if (albumTitle && !albumEmitted) flushAlbumRow();
  }

  return rows;
}

export type MatchedRow = ParsedRow & {
  match_status:
    | "matched"
    | "partial"
    | "unmatched"
    | "duplicate"
    | "skipped"
    | "conflict";
  matched_artist_id: string | null;
  matched_album_id: string | null;
  matched_submission_id: string | null;
  proposed_changes: Record<string, { table: string; field: string; before: string | null; after: string }>;
  notes: string | null;
};

export async function matchRows(parsed: ParsedRow[]): Promise<MatchedRow[]> {
  // Preload artists, albums, submissions
  const { data: artists } = await supabaseAdmin
    .from("artist_profiles")
    .select("id, name");
  const { data: albums } = await supabaseAdmin
    .from("albums")
    .select("id, title, artist_profile_id, upc");
  const { data: subs } = await supabaseAdmin
    .from("submissions")
    .select("id, title, album_id, artist_profile_id, isrc, upc");

  const artistByName = new Map<string, { id: string; name: string }>();
  for (const a of artists ?? []) artistByName.set(norm(a.name), a);

  const albumsByArtist = new Map<string, Array<{ id: string; title: string; upc: string | null }>>();
  for (const al of albums ?? []) {
    const arr = albumsByArtist.get(al.artist_profile_id) ?? [];
    arr.push({ id: al.id, title: al.title, upc: al.upc });
    albumsByArtist.set(al.artist_profile_id, arr);
  }

  const subsByAlbum = new Map<string, Array<{ id: string; title: string; isrc: string | null; upc: string | null }>>();
  const isrcOwner = new Map<string, string>(); // isrc -> submission_id
  for (const s of subs ?? []) {
    if (s.album_id) {
      const arr = subsByAlbum.get(s.album_id) ?? [];
      arr.push({ id: s.id, title: s.title, isrc: s.isrc, upc: s.upc });
      subsByAlbum.set(s.album_id, arr);
    }
    if (s.isrc) isrcOwner.set(s.isrc.toUpperCase(), s.id);
  }

  const out: MatchedRow[] = [];

  for (const r of parsed) {
    const result: MatchedRow = {
      ...r,
      match_status: "unmatched",
      matched_artist_id: null,
      matched_album_id: null,
      matched_submission_id: null,
      proposed_changes: {},
      notes: null,
    };

    const artist = r.artist_name_raw ? artistByName.get(norm(r.artist_name_raw)) : null;
    if (!artist) {
      result.notes = "Artist saknas i katalogen";
      out.push(result);
      continue;
    }
    result.matched_artist_id = artist.id;

    if (!r.album_title_raw) {
      result.match_status = "partial";
      result.notes = "Saknar albumtitel";
      out.push(result);
      continue;
    }

    const arr = albumsByArtist.get(artist.id) ?? [];
    const album = arr.find((a) => norm(a.title) === norm(r.album_title_raw));
    if (!album) {
      result.notes = `Album "${r.album_title_raw}" finns inte för ${artist.name}`;
      out.push(result);
      continue;
    }
    result.matched_album_id = album.id;

    // Album-only row (UPC) — no track title
    if (!r.track_title_raw) {
      if (r.upc_raw) {
        if (album.upc && album.upc === r.upc_raw) {
          result.match_status = "skipped";
          result.notes = "Album har redan denna UPC";
        } else if (album.upc && album.upc !== r.upc_raw) {
          result.match_status = "conflict";
          result.notes = `Album har redan UPC ${album.upc}`;
          result.proposed_changes.upc = {
            table: "albums",
            field: "upc",
            before: album.upc,
            after: r.upc_raw,
          };
        } else {
          result.match_status = "matched";
          result.proposed_changes.upc = {
            table: "albums",
            field: "upc",
            before: null,
            after: r.upc_raw,
          };
        }
      } else {
        result.match_status = "matched";
        result.notes = "Album-rad utan ändringar";
      }
      out.push(result);
      continue;
    }

    // Track row
    const albumSubs = subsByAlbum.get(album.id) ?? [];
    const sub = albumSubs.find((s) => norm(s.title) === norm(r.track_title_raw));
    if (!sub) {
      result.notes = `Låt "${r.track_title_raw}" finns inte på albumet`;
      out.push(result);
      continue;
    }
    result.matched_submission_id = sub.id;

    const proposals: MatchedRow["proposed_changes"] = {};
    let status: MatchedRow["match_status"] = "matched";
    const noteParts: string[] = [];

    if (r.isrc_raw) {
      const cur = sub.isrc?.toUpperCase() ?? null;
      const next = r.isrc_raw.toUpperCase();
      if (cur === next) {
        noteParts.push("ISRC oförändrad");
      } else if (cur && cur !== next) {
        status = "conflict";
        noteParts.push(`Konflikt: nuvarande ISRC ${cur}`);
        proposals.isrc = { table: "submissions", field: "isrc", before: cur, after: next };
      } else {
        const otherOwner = isrcOwner.get(next);
        if (otherOwner && otherOwner !== sub.id) {
          status = "duplicate";
          noteParts.push(`ISRC ${next} används redan av annan låt`);
        } else {
          proposals.isrc = { table: "submissions", field: "isrc", before: null, after: next };
        }
      }
    }

    // Inherit album UPC onto track if track lacks one and album has it (from this import or DB)
    const effectiveAlbumUpc = album.upc; // album row will be updated separately
    if (effectiveAlbumUpc && !sub.upc) {
      proposals.upc = { table: "submissions", field: "upc", before: null, after: effectiveAlbumUpc };
    }

    if (Object.keys(proposals).length === 0 && status === "matched") {
      status = "skipped";
      noteParts.push("Inga ändringar");
    }

    result.match_status = status;
    result.proposed_changes = proposals;
    result.notes = noteParts.join("; ") || null;
    out.push(result);
  }

  return out;
}