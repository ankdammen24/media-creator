import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Editor-rättighet för katalogen: ägare av posten, eller admin/artist-roll.
 * Allt körs via supabaseAdmin efter att vi verifierat behörigheten här.
 */
async function isAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(`role check: ${error.message}`);
  return !!data;
}

async function assertCatalogEditor(userId: string, ownerUserId: string | null) {
  if (ownerUserId && ownerUserId === userId) return;
  if (await isAdmin(userId)) return;
  throw new Error("Du saknar behörighet att redigera den här posten.");
}

/* -------------------- Artistprofil -------------------- */

const ArtistPatch = z.object({
  name: z.string().min(1).max(120),
  bio: z.string().max(4000).nullable(),
  avatar_path: z.string().max(500).nullable(),
  website_url: z.string().max(500).nullable(),
  facebook_url: z.string().max(500).nullable(),
  instagram_url: z.string().max(500).nullable(),
  x_url: z.string().max(500).nullable(),
  spotify_url: z.string().max(500).nullable(),
  apple_music_url: z.string().max(500).nullable(),
  amazon_music_url: z.string().max(500).nullable(),
});

export const updateArtistProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ artistId: z.string().uuid(), patch: ArtistPatch }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: existing, error: exErr } = await supabaseAdmin
      .from("artist_profiles")
      .select("id, user_id")
      .eq("id", data.artistId)
      .maybeSingle();
    if (exErr) throw new Error(exErr.message);
    if (!existing) throw new Error("Artist saknas.");
    await assertCatalogEditor(userId, existing.user_id);

    const { data: updated, error } = await supabaseAdmin
      .from("artist_profiles")
      .update(data.patch)
      .eq("id", data.artistId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return updated;
  });

/* -------------------- Album -------------------- */

const AlbumPatch = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(4000).nullable(),
  release_date: z.string().nullable(),
  album_type: z.enum(["album", "ep", "single", "compilation"]).optional(),
  genre: z.string().max(120).nullable(),
  artwork_path: z.string().max(500).nullable(),
  artist_profile_id: z.string().uuid().optional(),
});

export const updateAlbum = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ albumId: z.string().uuid(), patch: AlbumPatch.partial() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: existing, error: exErr } = await supabaseAdmin
      .from("albums")
      .select("id, user_id")
      .eq("id", data.albumId)
      .maybeSingle();
    if (exErr) throw new Error(exErr.message);
    if (!existing) throw new Error("Album saknas.");
    await assertCatalogEditor(userId, existing.user_id);

    // Om albumet pekas om till en annan artistprofil måste anroparen
    // också äga den nya artistprofilen (eller vara admin). Annars kan en
    // användare flytta sitt album in i en annan artists katalog.
    if (data.patch.artist_profile_id) {
      const { data: targetArtist, error: taErr } = await supabaseAdmin
        .from("artist_profiles")
        .select("id, user_id")
        .eq("id", data.patch.artist_profile_id)
        .maybeSingle();
      if (taErr) throw new Error(taErr.message);
      if (!targetArtist) throw new Error("Målartist saknas.");
      await assertCatalogEditor(userId, targetArtist.user_id);
    }

    const { data: updated, error } = await supabaseAdmin
      .from("albums")
      .update(data.patch)
      .eq("id", data.albumId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return updated;
  });

const NewAlbum = z.object({
  user_id: z.string().uuid(),
  artist_profile_id: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(4000).nullable().optional(),
  release_date: z.string().nullable().optional(),
  album_type: z.enum(["album", "ep", "single", "compilation"]).optional(),
  genre: z.string().max(120).nullable().optional(),
  artwork_path: z.string().max(500).nullable().optional(),
});

export const createAlbum = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => NewAlbum.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    // Inloggad användare måste äga artistprofilen, eller vara admin/artist.
    const { data: artist, error: aErr } = await supabaseAdmin
      .from("artist_profiles")
      .select("id, user_id")
      .eq("id", data.artist_profile_id)
      .maybeSingle();
    if (aErr) throw new Error(aErr.message);
    if (!artist) throw new Error("Artistprofil saknas.");
    await assertCatalogEditor(userId, artist.user_id);

    // Album ägs av den som skapar (artistens ägare om man är editor).
    const ownerUserId = artist.user_id ?? data.user_id;
    const { data: inserted, error } = await supabaseAdmin
      .from("albums")
      .insert({ ...data, user_id: ownerUserId })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return inserted;
  });

/* -------------------- Submission (låt) -------------------- */

const SubmissionPatch = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(4000).nullable().optional(),
  media_type: z.enum(["music", "podcast"]).optional(),
  album_id: z.string().uuid().nullable().optional(),
  track_number: z.number().int().positive().nullable().optional(),
  artwork_path: z.string().max(500).optional(),
  isrc: z.string().max(32).nullable().optional(),
  upc: z.string().max(32).nullable().optional(),
  artist_profile_id: z.string().uuid().optional(),
});

export const updateSubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ submissionId: z.string().uuid(), patch: SubmissionPatch }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: existing, error: exErr } = await supabaseAdmin
      .from("submissions")
      .select("id, user_id, artist_profile_id, album_id")
      .eq("id", data.submissionId)
      .maybeSingle();
    if (exErr) throw new Error(exErr.message);
    if (!existing) throw new Error("Låt saknas.");
    await assertCatalogEditor(userId, existing.user_id);

    const patch: Record<string, unknown> = { ...data.patch };

    // Byter vi artist på låten? (endast editor/admin för målartisten)
    const changingArtist =
      !!data.patch.artist_profile_id &&
      data.patch.artist_profile_id !== existing.artist_profile_id;
    const effectiveArtist = data.patch.artist_profile_id ?? existing.artist_profile_id;

    if (changingArtist) {
      const { data: targetArtist, error: taErr } = await supabaseAdmin
        .from("artist_profiles")
        .select("id, user_id")
        .eq("id", data.patch.artist_profile_id!)
        .maybeSingle();
      if (taErr) throw new Error(taErr.message);
      if (!targetArtist) throw new Error("Målartist saknas.");
      await assertCatalogEditor(userId, targetArtist.user_id);
    }

    // Albumets artist måste matcha låtens (effektiva) artist.
    const targetAlbumId =
      data.patch.album_id !== undefined ? data.patch.album_id : existing.album_id;
    if (targetAlbumId) {
      const { data: album, error: alErr } = await supabaseAdmin
        .from("albums")
        .select("id, artist_profile_id")
        .eq("id", targetAlbumId)
        .maybeSingle();
      if (alErr) throw new Error(alErr.message);
      if (!album) throw new Error("Målalbum saknas.");
      if (album.artist_profile_id !== effectiveArtist) {
        if (changingArtist) {
          // Vid artistbyte kopplar vi bort låten från det gamla albumet.
          patch.album_id = null;
          patch.track_number = null;
        } else {
          throw new Error("Låtens artist matchar inte albumets artist.");
        }
      }
    }

    const { data: updated, error } = await supabaseAdmin
      .from("submissions")
      .update(patch)
      .eq("id", data.submissionId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    // Synka kopplingstabellen (artistsidan läser via submission_artists).
    if (changingArtist) {
      const { error: delErr } = await supabaseAdmin
        .from("submission_artists")
        .delete()
        .eq("submission_id", data.submissionId)
        .eq("is_primary", true);
      if (delErr) throw new Error(delErr.message);
      const { error: insErr } = await supabaseAdmin
        .from("submission_artists")
        .insert({
          submission_id: data.submissionId,
          artist_profile_id: effectiveArtist,
          position: 0,
          is_primary: true,
        });
      if (insErr) throw new Error(insErr.message);
    }

    return updated;
  });

/* -------------------- Koppla låtar till album -------------------- */

export const attachSubmissionsToAlbum = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        albumId: z.string().uuid(),
        submissionIds: z.array(z.string().uuid()).min(1).max(200),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: album, error: alErr } = await supabaseAdmin
      .from("albums")
      .select("id, user_id, artist_profile_id")
      .eq("id", data.albumId)
      .maybeSingle();
    if (alErr) throw new Error(alErr.message);
    if (!album) throw new Error("Album saknas.");
    await assertCatalogEditor(userId, album.user_id);

    // Verifiera att alla låtar tillhör samma artist.
    const { data: subs, error: sErr } = await supabaseAdmin
      .from("submissions")
      .select("id, artist_profile_id, album_id")
      .in("id", data.submissionIds);
    if (sErr) throw new Error(sErr.message);
    for (const s of subs ?? []) {
      if (s.artist_profile_id !== album.artist_profile_id) {
        throw new Error("En eller flera låtar tillhör en annan artist.");
      }
    }

    // Nästa lediga track_number
    const { data: existing, error: tErr } = await supabaseAdmin
      .from("submissions")
      .select("track_number")
      .eq("album_id", data.albumId);
    if (tErr) throw new Error(tErr.message);
    let n =
      Math.max(
        0,
        ...((existing ?? [])
          .map((r) => r.track_number)
          .filter((v): v is number => typeof v === "number")),
      ) + 1;

    for (const id of data.submissionIds) {
      const { error } = await supabaseAdmin
        .from("submissions")
        .update({ album_id: data.albumId, track_number: n })
        .eq("id", id);
      if (error) throw new Error(error.message);
      n += 1;
    }
    return { ok: true, count: data.submissionIds.length };
  });

/* -------------------- Sortera om låtar i album -------------------- */

export const reorderAlbumTracks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        albumId: z.string().uuid(),
        orderedSubmissionIds: z.array(z.string().uuid()).min(1).max(500),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: album, error: alErr } = await supabaseAdmin
      .from("albums")
      .select("id, user_id")
      .eq("id", data.albumId)
      .maybeSingle();
    if (alErr) throw new Error(alErr.message);
    if (!album) throw new Error("Album saknas.");
    await assertCatalogEditor(userId, album.user_id);

    // Verifiera att alla låtar tillhör albumet.
    const { data: subs, error: sErr } = await supabaseAdmin
      .from("submissions")
      .select("id, album_id")
      .in("id", data.orderedSubmissionIds);
    if (sErr) throw new Error(sErr.message);
    const subMap = new Map((subs ?? []).map((s) => [s.id, s.album_id]));
    for (const id of data.orderedSubmissionIds) {
      if (subMap.get(id) !== data.albumId) {
        throw new Error("En eller flera låtar tillhör inte detta album.");
      }
    }

    // Tvåstegsuppdatering för att undvika krock med unique-indexet
    // (album_id, track_number): först till stora temporära värden
    // (måste vara >= 1 pga CHECK-constraintet submissions_music_requires_album),
    // sedan till slutgiltig ordning.
    const TMP_OFFSET = 1_000_000;
    let tmp = TMP_OFFSET;
    for (const id of data.orderedSubmissionIds) {
      const { error } = await supabaseAdmin
        .from("submissions")
        .update({ track_number: tmp })
        .eq("id", id);
      if (error) throw new Error(error.message);
      tmp += 1;
    }
    let n = 1;
    for (const id of data.orderedSubmissionIds) {
      const { error } = await supabaseAdmin
        .from("submissions")
        .update({ track_number: n })
        .eq("id", id);
      if (error) throw new Error(error.message);
      n += 1;
    }
    return { ok: true, count: data.orderedSubmissionIds.length };
  });

/* -------------------- Artist images -------------------- */

const ImageKind = z.enum(["avatar", "cover", "press"]);
const ImageVisibility = z.enum(["public", "link_only"]);

export const createArtistImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        artistId: z.string().uuid(),
        storage_path: z.string().min(1).max(500),
        kind: ImageKind,
        visibility: ImageVisibility.default("public"),
        sort_order: z.number().int().min(0).default(0),
        caption: z.string().max(300).nullable().optional(),
        credit: z.string().max(200).nullable().optional(),
        is_primary: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: artist, error: aErr } = await supabaseAdmin
      .from("artist_profiles")
      .select("id, user_id")
      .eq("id", data.artistId)
      .maybeSingle();
    if (aErr) throw new Error(aErr.message);
    if (!artist) throw new Error("Artist saknas.");
    await assertCatalogEditor(userId, artist.user_id);

    const ownerUserId = artist.user_id ?? userId;
    const { data: inserted, error } = await supabaseAdmin
      .from("artist_images")
      .insert({
        artist_profile_id: data.artistId,
        user_id: ownerUserId,
        storage_path: data.storage_path,
        kind: data.kind,
        visibility: data.visibility,
        sort_order: data.sort_order,
        caption: data.caption ?? null,
        credit: data.credit ?? null,
        is_primary: data.is_primary ?? false,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return inserted;
  });

const ArtistImagePatch = z.object({
  caption: z.string().max(300).nullable().optional(),
  credit: z.string().max(200).nullable().optional(),
  kind: ImageKind.optional(),
  visibility: ImageVisibility.optional(),
  sort_order: z.number().int().min(0).optional(),
});

export const updateArtistImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ imageId: z.string().uuid(), patch: ArtistImagePatch }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: existing, error: exErr } = await supabaseAdmin
      .from("artist_images")
      .select("id, user_id")
      .eq("id", data.imageId)
      .maybeSingle();
    if (exErr) throw new Error(exErr.message);
    if (!existing) throw new Error("Bild saknas.");
    await assertCatalogEditor(userId, existing.user_id);

    const { data: updated, error } = await supabaseAdmin
      .from("artist_images")
      .update(data.patch)
      .eq("id", data.imageId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return updated;
  });

export const setArtistImagePrimary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ imageId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: img, error: exErr } = await supabaseAdmin
      .from("artist_images")
      .select("id, user_id, artist_profile_id, kind")
      .eq("id", data.imageId)
      .maybeSingle();
    if (exErr) throw new Error(exErr.message);
    if (!img) throw new Error("Bild saknas.");
    if (img.kind === "press") throw new Error("Pressbilder kan inte vara primära.");
    await assertCatalogEditor(userId, img.user_id);

    const { error: unsetErr } = await supabaseAdmin
      .from("artist_images")
      .update({ is_primary: false })
      .eq("artist_profile_id", img.artist_profile_id)
      .eq("kind", img.kind)
      .eq("is_primary", true);
    if (unsetErr) throw new Error(unsetErr.message);

    const { error } = await supabaseAdmin
      .from("artist_images")
      .update({ is_primary: true })
      .eq("id", data.imageId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteArtistImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ imageId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: img, error: exErr } = await supabaseAdmin
      .from("artist_images")
      .select("id, user_id, storage_path")
      .eq("id", data.imageId)
      .maybeSingle();
    if (exErr) throw new Error(exErr.message);
    if (!img) throw new Error("Bild saknas.");
    await assertCatalogEditor(userId, img.user_id);

    const { error } = await supabaseAdmin
      .from("artist_images")
      .delete()
      .eq("id", data.imageId);
    if (error) throw new Error(error.message);
    if (img.storage_path) {
      await supabaseAdmin.storage.from("artwork").remove([img.storage_path]);
    }
    return { ok: true };
  });

export const deleteAlbum = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ albumId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: album, error: exErr } = await supabaseAdmin
      .from("albums")
      .select("id, user_id")
      .eq("id", data.albumId)
      .maybeSingle();
    if (exErr) throw new Error(exErr.message);
    if (!album) throw new Error("Album saknas.");
    await assertCatalogEditor(userId, album.user_id);

    const { error } = await supabaseAdmin.from("albums").delete().eq("id", data.albumId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteSubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ submissionId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: sub, error: exErr } = await supabaseAdmin
      .from("submissions")
      .select("id, user_id, audio_path, artwork_path")
      .eq("id", data.submissionId)
      .maybeSingle();
    if (exErr) throw new Error(exErr.message);
    if (!sub) throw new Error("Låt saknas.");
    await assertCatalogEditor(userId, sub.user_id);

    const { error } = await supabaseAdmin
      .from("submissions")
      .delete()
      .eq("id", data.submissionId);
    if (error) throw new Error(error.message);
    if (sub.audio_path) await supabaseAdmin.storage.from("audio").remove([sub.audio_path]);
    if (sub.artwork_path) await supabaseAdmin.storage.from("artwork").remove([sub.artwork_path]);
    return { ok: true };
  });