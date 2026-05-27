import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Music2, Mic, ArrowLeft } from "lucide-react";
import { EmptyState, ErrorState } from "@/components/StateViews";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/artists/$artistId")({
  head: () => ({
    meta: [
      { title: "Artist — Media Rosenqvist" },
      { name: "description", content: "Approved music and podcasts from this artist." },
    ],
  }),
  component: ArtistPage,
});

type ArtistData = {
  profile: { id: string; name: string; bio: string | null } | null;
  items: Array<{
    id: string;
    title: string;
    media_type: "music" | "podcast";
    artwork_path: string;
    audio_path: string;
    description: string | null;
    created_at: string;
  }>;
};

function publicArt(path: string) {
  return supabase.storage.from("artwork").getPublicUrl(path).data.publicUrl;
}

function ArtistPage() {
  const { artistId } = Route.useParams();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["artist", artistId],
    queryFn: async (): Promise<ArtistData> => {
      const [profileRes, itemsRes] = await Promise.all([
        supabase
          .from("artist_profiles")
          .select("id, name, bio")
          .eq("id", artistId)
          .maybeSingle(),
        supabase
          .from("submissions")
          .select("id, title, media_type, artwork_path, audio_path, description, created_at")
          .eq("status", "approved")
          .eq("artist_profile_id", artistId)
          .order("created_at", { ascending: false }),
      ]);
      if (profileRes.error) throw profileRes.error;
      if (itemsRes.error) throw itemsRes.error;
      return {
        profile: profileRes.data as ArtistData["profile"],
        items: (itemsRes.data ?? []) as ArtistData["items"],
      };
    },
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <Link
        to="/catalog"
        className="mb-6 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to catalog
      </Link>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : error ? (
        <ErrorState error={error as Error} onRetry={() => refetch()} />
      ) : !data?.profile ? (
        <EmptyState title="Artist not found" />
      ) : (
        <>
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight">{data.profile.name}</h1>
            {data.profile.bio && (
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{data.profile.bio}</p>
            )}
          </div>
          {data.items.length === 0 ? (
            <EmptyState
              title="No approved media yet"
              description="Once submissions from this artist are approved they'll appear here."
            />
          ) : (
            <ul className="space-y-3">
              {data.items.map((i) => (
                <ArtistRow key={i.id} item={i} />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function ArtistRow({ item }: { item: ArtistData["items"][number] }) {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  useEffect(() => {
    let on = true;
    supabase.storage
      .from("audio")
      .createSignedUrl(item.audio_path, 3600)
      .then(({ data }) => {
        if (on && data) setAudioUrl(data.signedUrl);
      });
    return () => {
      on = false;
    };
  }, [item.audio_path]);

  return (
    <li className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 sm:flex-row">
      <img
        src={publicArt(item.artwork_path)}
        alt={item.title}
        className="h-32 w-32 shrink-0 rounded-md object-cover"
      />
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
          {item.media_type === "music" ? <Music2 className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
          {item.media_type}
          <span>·</span>
          <span>{new Date(item.created_at).toLocaleDateString()}</span>
        </div>
        <h2 className="truncate text-base font-semibold">{item.title}</h2>
        {item.description && (
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.description}</p>
        )}
        {audioUrl ? (
          <audio controls preload="none" src={audioUrl} className="mt-3 h-9 w-full max-w-md">
            Your browser does not support audio.
          </audio>
        ) : (
          <div className="mt-3 h-9 w-full max-w-md animate-pulse rounded bg-secondary" />
        )}
      </div>
    </li>
  );
}