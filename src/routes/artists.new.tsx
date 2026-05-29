import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/artists/new")({
  head: () => ({
    meta: [
      { title: "Ansök om artistkonto — Catalogus Musicus" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <ProtectedRoute>
      <NewArtistPage />
    </ProtectedRoute>
  ),
});

function NewArtistPage() {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !name.trim()) return;
    setBusy(true);
    setErr(null);
    const { error } = await supabase
      .from("artist_profiles")
      .insert({
        user_id: user.id,
        name: name.trim(),
        bio: bio.trim() || null,
        website_url: website.trim() || null,
      });
    setBusy(false);
    if (error) {
      setErr(error.message ?? "Kunde inte skicka ansökan");
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
        <div className="rounded-xl border border-border bg-card p-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
            <CheckCircle2 className="h-6 w-6 text-primary" />
          </div>
          <h1 className="mb-2 text-xl font-semibold tracking-tight">Ansökan skickad</h1>
          <p className="text-sm text-muted-foreground">
            Tack! Din ansökan om artistkonto granskas av en administratör. Så
            snart den är godkänd kan du skicka in musik.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:px-6">
      <Link
        to="/my-submissions"
        className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Tillbaka
      </Link>
      <h1 className="mb-2 text-2xl font-semibold tracking-tight">Ansök om artistkonto</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Fyll i dina uppgifter och ansök om ett artistkonto. En administratör
        godkänner kontot innan du kan skicka in musik.
      </p>
      <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-border bg-card p-5">
        <div>
          <label className="mb-1 block text-xs font-medium">Namn *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={120}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Webbplats</label>
          <input
            type="url"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        {err && <p className="text-xs text-destructive">{err}</p>}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={busy || !name.trim()}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Skicka ansökan
          </button>
        </div>
      </form>
    </div>
  );
}