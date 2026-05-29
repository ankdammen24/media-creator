import { useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, UserPlus, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { selfApproveArtistAccount } from "@/lib/artist-self-approve.functions";

type GateProfile = {
  id: string;
  name: string;
  approval_status: "pending" | "approved" | "rejected";
  rejection_reason: string | null;
};

/**
 * Wraps the release wizard. Only users with an approved artist account can
 * submit music. Otherwise they see an application form (no account yet) or a
 * pending/rejected status message.
 */
export function ArtistAccountGate({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { t } = useTranslation();
  const selfApprove = useServerFn(selfApproveArtistAccount);
  const [activating, setActivating] = useState<string | null>(null);
  const [activateErr, setActivateErr] = useState<string | null>(null);

  const { data: profiles, isLoading } = useQuery({
    queryKey: ["my-artist-accounts", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("artist_profiles")
        .select("id, name, approval_status, rejection_reason")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as GateProfile[];
    },
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center text-sm text-muted-foreground">
        <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
        {t("artistGate.loading")}
      </div>
    );
  }

  const list = profiles ?? [];
  const hasApproved = list.some((p) => p.approval_status === "approved");
  if (hasApproved) return <>{children}</>;

  const inactive = list.find(
    (p) => p.approval_status === "pending" || p.approval_status === "rejected",
  );

  async function activateExisting(id: string) {
    setActivating(id);
    setActivateErr(null);
    try {
      await selfApprove({ data: { mode: "approveExisting", artistProfileId: id } });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["my-artist-accounts", user?.id] }),
        qc.invalidateQueries({ queryKey: ["editor-role", user?.id ?? null] }),
      ]);
    } catch (e) {
      setActivateErr(e instanceof Error ? e.message : String(e));
    } finally {
      setActivating(null);
    }
  }

  if (inactive) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
        <div className="rounded-xl border border-border bg-card p-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <h1 className="mb-2 text-xl font-semibold tracking-tight">
            {t("artistGate.activateTitle")}
          </h1>
          <p className="mb-4 text-sm text-muted-foreground">
            {t("artistGate.activateBodyPrefix")}
            <strong>{inactive.name}</strong>
            {t("artistGate.activateBodySuffix")}
          </p>
          {activateErr && (
            <p className="mb-3 text-xs text-destructive">{activateErr}</p>
          )}
          <button
            type="button"
            disabled={activating === inactive.id}
            onClick={() => activateExisting(inactive.id)}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {activating === inactive.id && (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            )}
            {t("artistGate.activateButton")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <ApplicationForm
      onCreated={() =>
        Promise.all([
          qc.invalidateQueries({ queryKey: ["my-artist-accounts", user?.id] }),
          qc.invalidateQueries({ queryKey: ["editor-role", user?.id ?? null] }),
        ])
      }
    />
  );
}

function ApplicationForm({ onCreated }: { onCreated: () => Promise<unknown> | void }) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const selfApprove = useServerFn(selfApproveArtistAccount);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !name.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      await selfApprove({
        data: {
          mode: "create",
          name: name.trim(),
          bio: bio.trim() || undefined,
          website: website.trim() || undefined,
        },
      });
      await onCreated();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.startsWith("DUPLICATE_ARTIST:")) {
        const dupName = msg.slice("DUPLICATE_ARTIST:".length);
        setErr(t("upload.duplicateArtist", { name: dupName }));
      } else {
        setErr(msg);
      }
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:px-6">
      <div className="mb-6 flex items-start gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-secondary">
          <UserPlus className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("artistGate.createTitle")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("artistGate.createBody")}
          </p>
        </div>
      </div>

      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-xl border border-border bg-card p-5"
      >
        <div>
          <label className="mb-1 block text-xs font-medium">{t("artistGate.artistName")} *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={120}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">{t("artistGate.bio")}</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder={t("artistGate.bioPlaceholder")}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">{t("artistGate.website")}</label>
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
            {t("artistGate.createButton")}
          </button>
        </div>
      </form>
    </div>
  );
}
