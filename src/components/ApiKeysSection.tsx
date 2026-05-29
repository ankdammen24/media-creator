import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, KeyRound, Plus, Copy, Check, Trash2 } from "lucide-react";
import {
  createUserApiKey,
  listMyApiKeys,
  revokeApiKey,
} from "@/lib/api-keys.functions";
import { USER_ALLOWED_SCOPES } from "@/lib/api-scopes";

const SCOPE_LABELS: Record<string, string> = {
  "read:catalog": "Läs katalog (egen och publik)",
  "write:submissions": "Skapa / uppdatera inskickningar",
  "write:albums": "Skapa / uppdatera album",
  "read:audio:web": "Signerade URL:er för web-master",
  "read:stats": "Egen statistik",
};

export function ApiKeysSection() {
  const qc = useQueryClient();
  const list = useServerFn(listMyApiKeys);
  const create = useServerFn(createUserApiKey);
  const revoke = useServerFn(revokeApiKey);
  const { data: keys, isLoading } = useQuery({
    queryKey: ["my-api-keys"],
    queryFn: () => list(),
  });
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [scopes, setScopes] = useState<string[]>(["read:catalog"]);
  const [expires, setExpires] = useState<string>("");
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
        },
      });
      setCreated({ plaintext: res.plaintext, label: res.label });
      setLabel("");
      setScopes(["read:catalog"]);
      setExpires("");
      qc.invalidateQueries({ queryKey: ["my-api-keys"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onRevoke(id: string) {
    if (!window.confirm("Återkalla denna nyckel? Den slutar fungera direkt.")) return;
    await revoke({ data: { id } });
    qc.invalidateQueries({ queryKey: ["my-api-keys"] });
  }

  function status(k: { revoked_at: string | null; expires_at: string | null }): {
    label: string;
    cls: string;
  } {
    if (k.revoked_at) return { label: "återkallad", cls: "bg-destructive/10 text-destructive" };
    if (k.expires_at && new Date(k.expires_at) < new Date())
      return { label: "utgången", cls: "bg-muted text-muted-foreground" };
    return { label: "aktiv", cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" };
  }

  return (
    <section className="mt-6 rounded-xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <KeyRound className="h-4 w-4" /> API-nycklar
          </h2>
          <p className="text-xs text-muted-foreground">
            Personliga nycklar för att komma åt skyddade endpoints.{" "}
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
            <Plus className="h-3.5 w-3.5" /> Ny nyckel
          </button>
        )}
      </div>

      {created && (
        <div className="mb-4 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
          <p className="font-medium text-foreground">
            Nyckeln "{created.label}" skapad. Den visas bara en gång — kopiera nu och förvara säkert.
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
        <div className="mb-4 rounded-md border border-border bg-background p-3">
          <label className="block text-xs font-medium">Etikett</label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={80}
            placeholder="t.ex. Min radioapp"
            className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          />
          <p className="mt-3 text-xs font-medium">Behörigheter</p>
          <div className="mt-1 grid gap-1.5 sm:grid-cols-2">
            {USER_ALLOWED_SCOPES.map((s) => (
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
                <span>
                  <code className="rounded bg-secondary px-1 text-[10px]">{s}</code>{" "}
                  <span className="text-muted-foreground">— {SCOPE_LABELS[s] ?? ""}</span>
                </span>
              </label>
            ))}
          </div>
          <label className="mt-3 block text-xs font-medium">Utgår om (dagar, valfritt)</label>
          <input
            type="number"
            min={1}
            max={3650}
            value={expires}
            onChange={(e) => setExpires(e.target.value)}
            placeholder="t.ex. 365"
            className="mt-1 w-32 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          />
          {error && (
            <p className="mt-2 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
              {error}
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <button
              onClick={submit}
              disabled={busy || !label.trim() || scopes.length === 0}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Skapa nyckel
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

      {isLoading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Laddar…
        </div>
      ) : (keys ?? []).length === 0 ? (
        <p className="text-xs text-muted-foreground">Inga nycklar än.</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {(keys ?? []).map((k) => {
            const st = status(k);
            return (
              <li key={k.id} className="flex flex-wrap items-center gap-2 p-3 text-xs">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{k.label}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] ${st.cls}`}>{st.label}</span>
                  </div>
                  <div className="mt-0.5 text-muted-foreground">
                    <code className="font-mono">{k.key_prefix}…</code>
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
    </section>
  );
}