import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, UserPlus, UserMinus, Mic, Search } from "lucide-react";
import {
  listUsersWithRoles,
  setUserArtistRole,
  createArtistProfileForUser,
} from "@/lib/admin-users.functions";

type Row = {
  user_id: string;
  display_name: string | null;
  created_at: string;
  roles: string[];
  artist_profiles: { id: string; name: string }[];
};

export function AdminUsers() {
  const qc = useQueryClient();
  const listFn = useServerFn(listUsersWithRoles);
  const toggleFn = useServerFn(setUserArtistRole);
  const createFn = useServerFn(createArtistProfileForUser);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users-with-roles"],
    queryFn: () => listFn() as Promise<Row[]>,
  });

  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [creating, setCreating] = useState<Row | null>(null);

  const filtered = useMemo(() => {
    const list = (data ?? []) as Row[];
    if (!q.trim()) return list;
    const s = q.toLowerCase();
    return list.filter(
      (r) =>
        (r.display_name ?? "").toLowerCase().includes(s) ||
        r.user_id.toLowerCase().includes(s) ||
        r.artist_profiles.some((a) => a.name.toLowerCase().includes(s)),
    );
  }, [data, q]);

  async function toggleArtist(row: Row, grant: boolean) {
    setBusy(row.user_id);
    try {
      await toggleFn({ data: { targetUserId: row.user_id, grant } });
      await qc.invalidateQueries({ queryKey: ["admin-users-with-roles"] });
    } catch (e) {
      window.alert((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Sök på namn, e-post eller artist…"
          className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-primary"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Laddar användare…
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">Inga användare matchar.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {filtered.map((r) => {
            const isArtist = r.roles.includes("artist");
            const isAdmin = r.roles.includes("admin");
            return (
              <li key={r.user_id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium">
                      {r.display_name || r.user_id}
                    </span>
                    {isAdmin && (
                      <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium uppercase text-primary">
                        admin
                      </span>
                    )}
                    {isArtist ? (
                      <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-medium uppercase text-accent-foreground">
                        artist
                      </span>
                    ) : (
                      <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
                        lyssnare
                      </span>
                    )}
                  </div>
                  {r.artist_profiles.length > 0 && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Artistprofiler: {r.artist_profiles.map((a) => a.name).join(", ")}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {isArtist ? (
                    <button
                      onClick={() => toggleArtist(r, false)}
                      disabled={busy === r.user_id}
                      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs hover:bg-secondary disabled:opacity-50"
                    >
                      <UserMinus className="h-3.5 w-3.5" /> Ta bort artist-roll
                    </button>
                  ) : (
                    <button
                      onClick={() => toggleArtist(r, true)}
                      disabled={busy === r.user_id}
                      className="inline-flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                    >
                      <UserPlus className="h-3.5 w-3.5" /> Gör till artist
                    </button>
                  )}
                  <button
                    onClick={() => setCreating(r)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs hover:bg-secondary"
                  >
                    <Mic className="h-3.5 w-3.5" /> Skapa artistprofil
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {creating && (
        <CreateArtistDialog
          row={creating}
          onClose={() => setCreating(null)}
          onCreate={async (name, bio, alsoGrant) => {
            await createFn({
              data: {
                targetUserId: creating.user_id,
                name,
                bio: bio || undefined,
                alsoGrantArtistRole: alsoGrant,
              },
            });
            await qc.invalidateQueries({ queryKey: ["admin-users-with-roles"] });
            await qc.invalidateQueries({ queryKey: ["admin-artists"] });
            setCreating(null);
          }}
        />
      )}
    </div>
  );
}

function CreateArtistDialog({
  row,
  onClose,
  onCreate,
}: {
  row: Row;
  onClose: () => void;
  onCreate: (name: string, bio: string, alsoGrant: boolean) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [grant, setGrant] = useState(!row.roles.includes("artist"));
  const [submitting, setSubmitting] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl">
        <h3 className="mb-1 text-sm font-semibold">Skapa artistprofil</h3>
        <p className="mb-4 text-xs text-muted-foreground">
          För användare <span className="font-medium text-foreground">{row.display_name || row.user_id}</span>
        </p>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Artistnamn</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Bio (valfritt)</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={grant} onChange={(e) => setGrant(e.target.checked)} />
            Ge även "artist"-rollen
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:bg-secondary"
          >
            Avbryt
          </button>
          <button
            disabled={submitting || !name.trim()}
            onClick={async () => {
              setSubmitting(true);
              try {
                await onCreate(name.trim(), bio.trim(), grant);
              } catch (e) {
                window.alert((e as Error).message);
              } finally {
                setSubmitting(false);
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Skapa
          </button>
        </div>
      </div>
    </div>
  );
}