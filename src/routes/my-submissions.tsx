import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Plus, UserCircle2, Disc3, Music2 } from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/lib/auth";
import { useEditorRole } from "@/lib/useEditorRole";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/my-submissions")({
  head: () => ({
    meta: [
      { title: "Mine — Media Rosenqvist" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <ProtectedRoute>
      <MyPage />
    </ProtectedRoute>
  ),
});

type ArtistRow = {
  id: string;
  name: string;
  avatar_path: string | null;
  user_id: string;
  albumCount: number;
  trackCount: number;
};

function MyPage() {
  const { user } = useAuth();
  const { isEditor, isAdmin } = useEditorRole();

  const { data, isLoading } = useQuery({
    queryKey: ["my-artists", user?.id, isEditor],
    enabled: !!user,
    queryFn: async (): Promise<ArtistRow[]> => {
      let q = supabase
        .from("artist_profiles")
        .select("id, name, avatar_path, user_id")
        .order("name", { ascending: true });
      if (!isEditor) q = q.eq("user_id", user!.id);
      const { data: artists, error } = await q;
      if (error) throw error;
      const list = (artists ?? []) as Array<{
        id: string;
        name: string;
        avatar_path: string | null;
        user_id: string;
      }>;
      const counts = await Promise.all(
        list.map(async (a) => {
          const [albumsRes, tracksRes] = await Promise.all([
            supabase
              .from("albums")
              .select("id", { count: "exact", head: true })
              .eq("artist_profile_id", a.id),
            supabase
              .from("submissions")
              .select("id", { count: "exact", head: true })
              .eq("artist_profile_id", a.id),
          ]);
          return {
            ...a,
            albumCount: albumsRes.count ?? 0,
            trackCount: tracksRes.count ?? 0,
          };
        }),
      );
      return counts;
    },
  });

  const artists = data ?? [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mine</h1>
          <p className="text-xs text-muted-foreground">
            {isAdmin
              ? "Alla artister i katalogen. Välj en för att se album och låtar."
              : isEditor
                ? "Alla artister du kan redigera."
                : "Dina artister. Välj en för att hantera album och låtar."}
          </p>
        </div>
        <Link
          to="/artists/new"
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-3.5 w-3.5" /> Skapa ny artist
        </Link>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Laddar…
        </div>
      ) : artists.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-6 text-center">
          <UserCircle2 className="mx-auto mb-2 h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Du har inga artister ännu.</p>
          <Link
            to="/artists/new"
            className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" /> Skapa din första artist
          </Link>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {artists.map((a) => (
            <ArtistCard key={a.id} a={a} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ArtistCard({ a }: { a: ArtistRow }) {
  const avatarUrl = a.avatar_path
    ? supabase.storage.from("artwork").getPublicUrl(a.avatar_path).data.publicUrl
    : null;
  return (
    <li>
      <Link
        to="/artists/$artistId"
        params={{ artistId: a.id }}
        className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition hover:bg-accent/40"
      >
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-secondary">
          {avatarUrl ? (
            <img src={avatarUrl} alt={a.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-muted-foreground">
              {a.name.slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold">{a.name}</p>
          <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Disc3 className="h-3 w-3" /> {a.albumCount} album
            </span>
            <span>·</span>
            <span className="inline-flex items-center gap-1">
              <Music2 className="h-3 w-3" /> {a.trackCount} låt{a.trackCount === 1 ? "" : "ar"}
            </span>
          </p>
        </div>
      </Link>
    </li>
  );
}