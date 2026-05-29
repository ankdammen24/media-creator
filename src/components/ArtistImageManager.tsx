import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import {
  createArtistImage,
  updateArtistImage,
  setArtistImagePrimary,
  deleteArtistImage,
} from "@/lib/catalog-edit.functions";
import { Upload as UploadIcon, Trash2, Star, Eye, EyeOff, ImagePlus, Sparkles, Wand2 } from "lucide-react";
import { AiImageGenerator } from "@/components/AiImageGenerator";
import { StorageErrorAlert } from "@/components/StorageErrorAlert";

export type ArtistImage = {
  id: string;
  artist_profile_id: string;
  user_id: string;
  storage_path: string;
  kind: "avatar" | "cover" | "press";
  is_primary: boolean;
  visibility: "public" | "link_only";
  caption: string | null;
  credit: string | null;
  sort_order: number;
  created_at: string;
};

const MAX_BYTES = 8 * 1024 * 1024;
const IMG_EXT = ["jpg", "jpeg", "png", "webp"];

const KIND_LABEL: Record<ArtistImage["kind"], string> = {
  avatar: "Profilbild",
  cover: "Omslag / hero",
  press: "Pressbild",
};

function ext(name: string) {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

function publicUrl(path: string) {
  return supabase.storage.from("artwork").getPublicUrl(path).data.publicUrl;
}

export function ArtistImageManager({
  artistId,
  userId,
  artistName,
}: {
  artistId: string;
  userId: string;
  artistName: string;
}) {
  const [images, setImages] = useState<ArtistImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadKind, setUploadKind] = useState<ArtistImage["kind"]>("press");
  const [aiOpen, setAiOpen] = useState<
    | { mode: "new"; kind: ArtistImage["kind"] }
    | { mode: "variant"; kind: ArtistImage["kind"]; path: string }
    | null
  >(null);
  const createFn = useServerFn(createArtistImage);
  const updateFn = useServerFn(updateArtistImage);
  const setPrimaryFn = useServerFn(setArtistImagePrimary);
  const deleteFn = useServerFn(deleteArtistImage);

  async function reload() {
    setLoading(true);
    const { data, error } = await supabase
      .from("artist_images")
      .select("*")
      .eq("artist_profile_id", artistId)
      .order("kind", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) setError(error.message);
    else setImages((data ?? []) as ArtistImage[]);
    setLoading(false);
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artistId]);

  async function onUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        if (!IMG_EXT.includes(ext(file.name))) {
          throw new Error(`Filtyp ej tillåten: ${file.name}`);
        }
        if (file.size > MAX_BYTES) {
          throw new Error(`För stor fil (max 8 MB): ${file.name}`);
        }
        // Första mappsegmentet MÅSTE vara auth.uid() (= userId) för att storage-RLS ska tillåta uppladdning.
        const path = `${userId}/artists/${artistId}/${crypto.randomUUID()}.${ext(file.name)}`;
        const up = await supabase.storage
          .from("artwork")
          .upload(path, file, { upsert: false, contentType: file.type || undefined });
        if (up.error) throw up.error;

        await createFn({
          data: {
            artistId,
            storage_path: path,
            kind: uploadKind,
            visibility: "public",
            sort_order: images.length,
          },
        });
      }
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Uppladdning misslyckades");
    } finally {
      setBusy(false);
    }
  }

  async function setPrimary(img: ArtistImage) {
    if (img.kind === "press") return;
    setBusy(true);
    setError(null);
    try {
      await setPrimaryFn({ data: { imageId: img.id } });
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunde inte sätta primär");
    } finally {
      setBusy(false);
    }
  }

  async function toggleVisibility(img: ArtistImage) {
    setBusy(true);
    setError(null);
    try {
      const next = img.visibility === "public" ? "link_only" : "public";
      await updateFn({ data: { imageId: img.id, patch: { visibility: next } } });
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunde inte ändra synlighet");
    } finally {
      setBusy(false);
    }
  }

  async function updateMeta(id: string, patch: Partial<Pick<ArtistImage, "caption" | "credit" | "kind">>) {
    try {
      await updateFn({ data: { imageId: id, patch } });
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunde inte uppdatera");
    }
  }

  async function remove(img: ArtistImage) {
    if (!confirm("Ta bort den här bilden?")) return;
    setBusy(true);
    setError(null);
    try {
      await deleteFn({ data: { imageId: img.id } });
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunde inte ta bort");
    } finally {
      setBusy(false);
    }
  }

  const grouped: Record<ArtistImage["kind"], ArtistImage[]> = {
    avatar: images.filter((i) => i.kind === "avatar"),
    cover: images.filter((i) => i.kind === "cover"),
    press: images.filter((i) => i.kind === "press"),
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">Bildgalleri (EPK)</h3>
          <p className="text-xs text-muted-foreground">
            Profilbilder, omslag och pressbilder. Markera en primär per typ. "Endast länk" döljer
            bilden i publika listor.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-md border border-dashed border-border bg-background p-3">
        <div>
          <label className="mb-1 block text-xs font-medium">Typ</label>
          <select
            value={uploadKind}
            onChange={(e) => setUploadKind(e.target.value as ArtistImage["kind"])}
            className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          >
            <option value="press">Pressbild</option>
            <option value="avatar">Profilbild</option>
            <option value="cover">Omslag / hero</option>
          </select>
        </div>
        <label className="inline-flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground hover:bg-accent/40">
          <UploadIcon className="h-4 w-4" />
          {busy ? "Laddar upp…" : "Ladda upp bild(er)"}
          <input
            type="file"
            multiple
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              void onUpload(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={() => setAiOpen({ mode: "new", kind: uploadKind })}
          className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-primary hover:bg-primary/20 disabled:opacity-50"
          title="Skapa bild med AI (~$0.035)"
        >
          <Sparkles className="h-4 w-4" />
          Skapa med AI
        </button>
      </div>

      {error && <StorageErrorAlert message={error} />}

      {loading ? (
        <p className="text-sm text-muted-foreground">Laddar bilder…</p>
      ) : images.length === 0 ? (
        <div className="flex items-center gap-2 rounded-md border border-dashed border-border bg-background p-4 text-sm text-muted-foreground">
          <ImagePlus className="h-4 w-4" />
          Inga bilder ännu. Ladda upp ovan.
        </div>
      ) : (
        <div className="space-y-5">
          {(Object.keys(grouped) as ArtistImage["kind"][]).map((k) =>
            grouped[k].length === 0 ? null : (
              <section key={k}>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {KIND_LABEL[k]}
                </h4>
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {grouped[k].map((img) => (
                    <li
                      key={img.id}
                      className="overflow-hidden rounded-lg border border-border bg-background"
                    >
                      <div className="relative aspect-square bg-secondary">
                        <img
                          src={publicUrl(img.storage_path)}
                          alt={img.caption ?? ""}
                          className="h-full w-full object-cover"
                        />
                        {img.is_primary && (
                          <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
                            <Star className="h-3 w-3 fill-current" /> Primär
                          </span>
                        )}
                        <span className="absolute right-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-background/85 px-2 py-0.5 text-[10px] backdrop-blur">
                          {img.visibility === "public" ? (
                            <>
                              <Eye className="h-3 w-3" /> Publik
                            </>
                          ) : (
                            <>
                              <EyeOff className="h-3 w-3" /> Endast länk
                            </>
                          )}
                        </span>
                      </div>
                      <div className="space-y-1.5 p-2 text-xs">
                        <input
                          defaultValue={img.caption ?? ""}
                          placeholder="Bildtext"
                          maxLength={200}
                          onBlur={(e) =>
                            e.target.value !== (img.caption ?? "") &&
                            updateMeta(img.id, { caption: e.target.value || null })
                          }
                          className="w-full rounded border border-border bg-background px-2 py-1"
                        />
                        <input
                          defaultValue={img.credit ?? ""}
                          placeholder="Foto / kredd"
                          maxLength={120}
                          onBlur={(e) =>
                            e.target.value !== (img.credit ?? "") &&
                            updateMeta(img.id, { credit: e.target.value || null })
                          }
                          className="w-full rounded border border-border bg-background px-2 py-1"
                        />
                        <div className="flex flex-wrap gap-1 pt-1">
                          {img.kind !== "press" && !img.is_primary && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => setPrimary(img)}
                              className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-1 hover:bg-accent"
                              title="Markera som primär"
                            >
                              <Star className="h-3 w-3" /> Primär
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => toggleVisibility(img)}
                            className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-1 hover:bg-accent"
                            title="Växla synlighet"
                          >
                            {img.visibility === "public" ? (
                              <EyeOff className="h-3 w-3" />
                            ) : (
                              <Eye className="h-3 w-3" />
                            )}
                          </button>
                          <select
                            value={img.kind}
                            disabled={busy}
                            onChange={(e) =>
                              updateMeta(img.id, { kind: e.target.value as ArtistImage["kind"] })
                            }
                            className="rounded border border-border bg-background px-1.5 py-1"
                            title="Byt typ"
                          >
                            <option value="press">Press</option>
                            <option value="avatar">Avatar</option>
                            <option value="cover">Cover</option>
                          </select>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => remove(img)}
                            className="ml-auto inline-flex items-center gap-1 rounded border border-destructive/30 px-1.5 py-1 text-destructive hover:bg-destructive/10"
                            title="Ta bort"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              setAiOpen({
                                mode: "variant",
                                kind: img.kind,
                                path: img.storage_path,
                              })
                            }
                            className="inline-flex items-center gap-1 rounded border border-primary/40 px-1.5 py-1 text-primary hover:bg-primary/10"
                            title="Variera med AI"
                          >
                            <Wand2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ),
          )}
        </div>
      )}

      {aiOpen && (
        <AiImageGenerator
          artistId={artistId}
          userId={userId}
          artistName={artistName}
          defaultKind={aiOpen.kind}
          referenceImagePath={aiOpen.mode === "variant" ? aiOpen.path : null}
          onClose={() => setAiOpen(null)}
          onSaved={() => {
            setAiOpen(null);
            void reload();
          }}
        />
      )}
    </div>
  );
}