import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search, Music2, Mic, User as UserIcon, Disc3 } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { effectiveArtworkPath } from "@/lib/album-helpers";

type SubmissionHit = {
  id: string;
  title: string;
  description: string | null;
  media_type: "music" | "podcast";
  artwork_path: string;
  artist_profiles: { id: string; name: string } | null;
  albums: { artwork_path: string | null } | null;
};

type ArtistHit = {
  id: string;
  name: string;
};

type AlbumHit = {
  id: string;
  title: string;
  artwork_path: string | null;
  artist_profiles: { id: string; name: string } | null;
};

function artworkUrl(path: string) {
  return supabase.storage.from("artwork").getPublicUrl(path).data.publicUrl;
}

async function runSearch(q: string): Promise<{
  submissions: SubmissionHit[];
  albums: AlbumHit[];
  artists: ArtistHit[];
}> {
  const like = `%${q.replace(/[%_]/g, (m) => `\\${m}`)}%`;

  const [submissions, albums, artists] = await Promise.all([
    supabase
      .from("submissions")
      .select("id, title, description, media_type, artwork_path, artist_profiles!submissions_artist_profile_id_fkey(id, name), albums(artwork_path)")
      .eq("status", "approved")
      .ilike("title", like)
      .limit(10),
    supabase
      .from("albums")
      .select("id, title, artwork_path, artist_profiles(id, name)")
      .ilike("title", like)
      .limit(10),
    supabase
      .from("artist_profiles")
      .select("id, name")
      .ilike("name", like)
      .limit(10),
  ]);

  if (submissions.error) throw submissions.error;
  if (albums.error) throw albums.error;
  if (artists.error) throw artists.error;

  return {
    submissions: (submissions.data ?? []) as unknown as SubmissionHit[],
    albums: (albums.data ?? []) as unknown as AlbumHit[],
    artists: (artists.data ?? []) as ArtistHit[],
  };
}

export function GlobalSearch() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(input.trim()), 200);
    return () => clearTimeout(t);
  }, [input]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) setInput("");
  }, [open]);

  const enabled = debounced.length >= 2;
  const { data, isFetching } = useQuery({
    queryKey: ["global-search", debounced],
    queryFn: () => runSearch(debounced),
    enabled,
    staleTime: 30_000,
  });

  const go = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Sök"
        className="hidden sm:flex items-center gap-2 rounded-md border border-border bg-card/60 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-card transition w-full max-w-sm"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">Sök i katalogen…</span>
        <kbd className="hidden md:inline-flex h-5 items-center rounded border border-border bg-background px-1.5 font-mono text-[10px] text-muted-foreground">
          ⌘K
        </kbd>
      </button>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Sök"
        className="sm:hidden inline-flex items-center justify-center rounded-md border border-border p-1.5 text-muted-foreground hover:text-foreground"
      >
        <Search className="h-4 w-4" />
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          value={input}
          onValueChange={setInput}
          placeholder="Sök artist, album eller låt…"
        />
        <CommandList>
          {!enabled ? (
            <CommandEmpty>Skriv minst 2 tecken för att söka.</CommandEmpty>
          ) : isFetching && !data ? (
            <CommandEmpty>Söker…</CommandEmpty>
          ) : (data?.submissions.length ?? 0) + (data?.albums.length ?? 0) + (data?.artists.length ?? 0) === 0 ? (
            <CommandEmpty>Inga träffar.</CommandEmpty>
          ) : (
            <>
              {data && data.artists.length > 0 && (
                <CommandGroup heading="Artister">
                  {data.artists.map((a) => (
                    <CommandItem
                      key={a.id}
                      value={`artist-${a.id}-${a.name}`}
                      onSelect={() =>
                        go(() =>
                          navigate({
                            to: "/artists/$artistId",
                            params: { artistId: a.id },
                          }),
                        )
                      }
                    >
                      <UserIcon className="h-4 w-4 text-muted-foreground" />
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate text-sm">{a.name}</span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {data && data.albums.length > 0 && (
                <CommandGroup heading="Album">
                  {data.albums.map((al) => (
                    <CommandItem
                      key={al.id}
                      value={`album-${al.id}-${al.title}-${al.artist_profiles?.name ?? ""}`}
                      onSelect={() =>
                        go(() =>
                          navigate({
                            to: "/albums/$albumId",
                            params: { albumId: al.id },
                          }),
                        )
                      }
                    >
                      {al.artwork_path ? (
                        <img
                          src={artworkUrl(al.artwork_path)}
                          alt=""
                          className="h-8 w-8 rounded object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <Disc3 className="h-4 w-4 text-muted-foreground" />
                      )}
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate text-sm">{al.title}</span>
                        <span className="truncate text-xs text-muted-foreground">
                          {al.artist_profiles?.name ?? "Okänd artist"}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {data && data.submissions.length > 0 && (
                <CommandGroup heading="Spår & podd">
                  {data.submissions.map((s) => (
                    <CommandItem
                      key={s.id}
                      value={`submission-${s.id}-${s.title}-${s.artist_profiles?.name ?? ""}`}
                      onSelect={() =>
                        go(() =>
                          navigate({ to: "/catalog", search: { focus: s.id } as never }),
                        )
                      }
                    >
                      <img
                        src={artworkUrl(effectiveArtworkPath(s) ?? s.artwork_path)}
                        alt=""
                        className="h-8 w-8 rounded object-cover"
                        loading="lazy"
                      />
                      <div className="flex min-w-0 flex-col">
                        <span className="flex items-center gap-1.5 truncate text-sm">
                          {s.media_type === "music" ? (
                            <Music2 className="h-3 w-3 text-muted-foreground" />
                          ) : (
                            <Mic className="h-3 w-3 text-muted-foreground" />
                          )}
                          <span className="truncate">{s.title}</span>
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {s.artist_profiles?.name ?? "Okänd artist"}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}