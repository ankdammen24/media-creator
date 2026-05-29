import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, KeyRound, Plus, Copy, Check, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  createServiceApiKey,
  listServiceApiKeys,
  revokeServiceApiKey,
} from "@/lib/api-keys.functions";
import { ALL_SCOPES } from "@/lib/api-scopes";

export function AdminApiKeys() {
  const qc = useQueryClient();
  const list = useServerFn(listServiceApiKeys);
  const create = useServerFn(createServiceApiKey);
  const revoke = useServerFn(revokeServiceApiKey);

  const { data: keys, isLoading } = useQuery({
    queryKey: ["service-api-keys"],
    queryFn: () => list(),
  });
  const { data: users } = useQuery({
    queryKey: ["admin-users-select"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .order("display_name");
      return data ?? [];
    },
  });

  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [scopes, setScopes] = useState<string[]>(["read:catalog"]);
  const [expires, setExpires] = useState("");
  const [owner, setOwner] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ plaintext: string; label: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const res = await create({
        data: {
          label: label.trim(),
          scopes,
          expiresInDays: expires ? Number(expires) : null,
          ownerUserId: owner || null,
        },
      });
      setCreated({ plaintext: res.plaintext, label: res.label });
      setLabel("");
      setScopes(["read:catalog"]);
      setExpires("");
      setOwner("");
      qc.invalidateQueries({ queryKey: ["service-api-keys"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onRevoke(id: string) {
    if (!window.confirm("Återkalla denna tjänste-nyckel? Den slutar fungera direkt.")) return;
    await revoke({ data: { id } });
    qc.invalidateQueries({ queryKey: ["service-api-keys"] });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <KeyRound className="h-4 w-4" /> Tjänste-nycklar
            </h2>
            <p className="text-xs text-muted-foreground">
              För externa integrationer (t.ex. Radio Uppsala). Dela alltid via en lösenordshanterare —
              nyckeln visas bara en gång vid skapandet.
              {" "}
              <a href="/api-docs" className="text-primary hover:underline">
                Se API-dokumentation
              </a>
              .
            </p>
          </div>
          {!open && !created && (
            <button
              onClick={() => setOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-3.5 w-3.5" /> Ny tjänste-nyckel
            </button>
          )}
        </div>

        {created && (
          <div className="mt-4 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
            <p className="font-medium text-foreground">
              Nyckeln "{created.label}" skapad. Visas bara en gång — kopiera och förvara säkert.
            </p>
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 truncate rounded bg-background px-2 py-1.5 font-mono text-[11px]">
                {created.plaintext}
              </code>
              <button
                onClick={() => {
                  void navigator.clipboard.writeText(created.plaintext);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1.5 text-xs hover:bg-secondary"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Kopierad" : "Kopiera"}
              </button>
            </div>
            <button
              onClick={() => {
                setCreated(null);
                setOpen(false);
              }}
              className="mt-2 text-xs text-muted-foreground hover:underline"
            >
              Klar
            </button>
          </div>
        )}

        {open && !created && (
          <div className="mt-4 grid gap-3 rounded-md border border-border bg-background p-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium">Etikett</label>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                maxLength={80}
                placeholder="t.ex. Radio Uppsala – produktion"
                className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium">Koppla till användare (valfritt)</label>
              <select
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              >
                <option value="">— Global (alla artister) —</option>
                {(users ?? []).map((u) => (
                  <option key={u.user_id} value={u.user_id}>
                    {u.display_name ?? u.user_id}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Om satt: skrivåtkomst scopas till den användarens artister.
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium">Utgår om (dagar, valfritt)</label>
              <input
                type="number"
                min={1}
                max={3650}
                value={expires}
                onChange={(e) => setExpires(e.target.value)}
                placeholder="t.ex. 365"
                className="mt-1 w-32 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs font-medium">Behörigheter</p>
              <div className="mt-1 grid gap-1.5 sm:grid-cols-2">
                {ALL_SCOPES.map((s) => (
                  <label key={s} className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={scopes.includes(s)}
                      onChange={(e) =>
                        setScopes((prev) =>
                          e.target.checked ? [...prev, s] : prev.filter((x) => x !== s),
                        )
                      }
                    />
                    <code className="rounded bg-secondary px-1 text-[10px]">{s}</code>
                  </label>
                ))}
              </div>
            </div>
            {error && (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive sm:col-span-2">
                {error}
              </p>
            )}
            <div className="flex gap-2 sm:col-span-2">
              <button
                onClick={submit}
                disabled={busy || !label.trim() || scopes.length === 0}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Skapa tjänste-nyckel
              </button>
              <button
                onClick={() => {
                  setOpen(false);
                  setError(null);
                }}
                className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-secondary"
              >
                Avbryt
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-3 text-sm font-semibold">Befintliga tjänste-nycklar</h3>
        {isLoading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Laddar…
          </div>
        ) : (keys ?? []).length === 0 ? (
          <p className="text-xs text-muted-foreground">Inga tjänste-nycklar än.</p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {(keys ?? []).map((k) => {
              const expired = k.expires_at && new Date(k.expires_at) < new Date();
              const ownerName = k.owner_user_id
                ? users?.find((u) => u.user_id === k.owner_user_id)?.display_name ?? k.owner_user_id
                : "Global";
              return (
                <li key={k.id} className="flex flex-wrap items-center gap-2 p-3 text-xs">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{k.label}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] ${
                          k.revoked_at
                            ? "bg-destructive/10 text-destructive"
                            : expired
                              ? "bg-muted text-muted-foreground"
                              : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        }`}
                      >
                        {k.revoked_at ? "återkallad" : expired ? "utgången" : "aktiv"}
                      </span>
                    </div>
                    <div className="mt-0.5 text-muted-foreground">
                      <code className="font-mono">{k.key_prefix}…</code>
                      {" · "}
                      Ägare: {ownerName}
                      {" · "}
                      {(k.scopes as string[]).join(", ")}
                      {k.last_used_at
                        ? ` · senast använd ${new Date(k.last_used_at).toLocaleDateString()}`
                        : " · aldrig använd"}
                    </div>
                  </div>
                  {!k.revoked_at && (
                    <button
                      onClick={() => onRevoke(k.id)}
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] hover:bg-secondary"
                    >
                      <Trash2 className="h-3 w-3" /> Återkalla
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}