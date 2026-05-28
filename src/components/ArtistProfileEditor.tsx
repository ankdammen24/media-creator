import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X, Upload as UploadIcon } from "lucide-react";

export type EditableArtist = {
  id: string;
  user_id: string;
  name: string;
  bio: string | null;
  avatar_path: string | null;
  website_url: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  x_url: string | null;
  spotify_url: string | null;
  apple_music_url: string | null;
  amazon_music_url: string | null;
};

const URL_FIELDS: Array<{ key: keyof EditableArtist; label: string; placeholder: string }> = [
  { key: "website_url", label: "Webbplats", placeholder: "https://exempel.se" },
  { key: "facebook_url", label: "Facebook", placeholder: "https://facebook.com/…" },
  { key: "instagram_url", label: "Instagram", placeholder: "https://instagram.com/…" },
  { key: "x_url", label: "X (Twitter)", placeholder: "https://x.com/…" },
  { key: "spotify_url", label: "Spotify", placeholder: "https://open.spotify.com/artist/…" },
  { key: "apple_music_url", label: "Apple Music", placeholder: "https://music.apple.com/…" },
  { key: "amazon_music_url", label: "Amazon Music", placeholder: "https://music.amazon.com/…" },
];

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const IMG_EXT = ["jpg", "jpeg", "png", "webp"];

function ext(name: string) {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

function validUrlOrEmpty(v: string): boolean {
  if (!v) return true;
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function ArtistProfileEditor({
  artist,
  onClose,
  onSaved,
}: {
  artist: EditableArtist;
  onClose: () => void;
  onSaved: (updated: EditableArtist) => void;
}) {
  const [name, setName] = useState(artist.name);
  const [bio, setBio] = useState(artist.bio ?? "");
  const [urls, setUrls] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      URL_FIELDS.map((f) => [f.key, (artist[f.key] as string | null) ?? ""]),
    ),
  );
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const invalidUrls = URL_FIELDS.filter((f) => !validUrlOrEmpty(urls[f.key as string]));

  const avatarFileError = (() => {
    if (!avatarFile) return null;
    if (!IMG_EXT.includes(ext(avatarFile.name))) return "Bilden måste vara JPG, PNG eller WEBP.";
    if (avatarFile.size > MAX_AVATAR_BYTES) return "Bilden är för stor (max 5 MB).";
    return null;
  })();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || invalidUrls.length > 0 || avatarFileError) return;
    setSaving(true);
    setError(null);
    try {
      let avatar_path = artist.avatar_path;
      if (avatarFile) {
        const path = `artists/${artist.user_id}/${artist.id}-${Date.now()}.${ext(avatarFile.name)}`;
        const up = await supabase.storage
          .from("artwork")
          .upload(path, avatarFile, { upsert: false, contentType: avatarFile.type || undefined });
        if (up.error) throw up.error;
        avatar_path = path;
      }

      const patch = {
        name: name.trim(),
        bio: bio.trim() || null,
        avatar_path,
        website_url: urls.website_url.trim() || null,
        facebook_url: urls.facebook_url.trim() || null,
        instagram_url: urls.instagram_url.trim() || null,
        x_url: urls.x_url.trim() || null,
        spotify_url: urls.spotify_url.trim() || null,
        apple_music_url: urls.apple_music_url.trim() || null,
        amazon_music_url: urls.amazon_music_url.trim() || null,
      };

      const { data, error: updErr } = await supabase
        .from("artist_profiles")
        .update(patch)
        .eq("id", artist.id)
        .select("*")
        .single();
      if (updErr) throw updErr;
      onSaved(data as EditableArtist);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte spara");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Redigera profil</h2>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Stäng"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium">Namn</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium">Biografi</label>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={4}
          maxLength={2000}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium">Profilbild (JPG/PNG/WEBP, max 5 MB)</label>
        <label className="flex h-24 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border bg-background text-sm text-muted-foreground hover:bg-accent/40">
          <UploadIcon className="h-4 w-4" />
          {avatarFile ? avatarFile.name : "Välj ny bild (valfritt)"}
          <input
            type="file"
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)}
          />
        </label>
        {avatarFileError && <p className="mt-1 text-xs text-destructive">{avatarFileError}</p>}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {URL_FIELDS.map((f) => (
          <div key={f.key as string}>
            <label className="mb-1 block text-xs font-medium">{f.label}</label>
            <input
              type="url"
              value={urls[f.key as string]}
              onChange={(e) =>
                setUrls((cur) => ({ ...cur, [f.key as string]: e.target.value }))
              }
              placeholder={f.placeholder}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            {!validUrlOrEmpty(urls[f.key as string]) && (
              <p className="mt-1 text-xs text-destructive">Ogiltig URL (måste börja med http(s)://).</p>
            )}
          </div>
        ))}
      </div>

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-border px-3 py-2 text-sm hover:bg-accent"
        >
          Avbryt
        </button>
        <button
          type="submit"
          disabled={saving || !name.trim() || invalidUrls.length > 0 || !!avatarFileError}
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {saving ? "Sparar…" : "Spara"}
        </button>
      </div>
    </form>
  );
}