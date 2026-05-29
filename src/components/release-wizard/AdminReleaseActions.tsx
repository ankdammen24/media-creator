import { useState } from "react";
import { Check, X, Globe, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { ReleaseStatusBadge, type ReleaseStatus } from "./ReleaseStatusBadge";

/**
 * Placeholder admin actions for releases. Mounted by admin tools when ready.
 * Owner/admin RLS on albums enforces who can write.
 */
export function AdminReleaseActions({
  albumId,
  initialStatus,
  initialNotes,
}: {
  albumId: string;
  initialStatus: ReleaseStatus;
  initialNotes?: string | null;
}) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<ReleaseStatus>(initialStatus);
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function update(next: ReleaseStatus) {
    setBusy(true);
    setErr(null);
    try {
      const patch = {
        status: next,
        internal_notes: notes.trim() || null,
        ...(next === "published"
          ? { published_at: new Date().toISOString() }
          : {}),
      };
      const { error } = await supabase
        .from("albums")
        .update(patch)
        .eq("id", albumId);
      if (error) throw error;
      setStatus(next);
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("adminRelease.updateFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{t("adminRelease.heading")}</h3>
        <ReleaseStatusBadge status={status} />
      </div>
      <textarea
        rows={3}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder={t("adminRelease.notesPlaceholder")}
        className="mb-3 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
      />
      <div className="flex flex-wrap gap-2">
        <button
          disabled={busy}
          onClick={() => update("approved")}
          className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/15 px-3 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-500/25 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
          {t("adminRelease.approve")}
        </button>
        <button
          disabled={busy}
          onClick={() => update("rejected")}
          className="inline-flex items-center gap-1.5 rounded-md bg-destructive/15 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/25 disabled:opacity-50"
        >
          <X className="h-3 w-3" /> {t("adminRelease.reject")}
        </button>
        <button
          disabled={busy || status !== "approved"}
          onClick={() => update("published")}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary/15 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/25 disabled:opacity-50"
        >
          <Globe className="h-3 w-3" /> {t("adminRelease.publish")}
        </button>
      </div>
      {err && <p className="mt-2 text-xs text-destructive">{err}</p>}
    </section>
  );
}

/**
 * Placeholder email notification settings. Frontend-only for now.
 */
export function EmailNotificationSettings() {
  const { t } = useTranslation();
  const [approval, setApproval] = useState(true);
  const [rejection, setRejection] = useState(true);
  const [lang, setLang] = useState<"sv" | "en">("sv");

  return (
    <section className="rounded-xl border border-border bg-card p-4 text-sm">
      <h3 className="mb-3 font-semibold">{t("adminRelease.emailHeading")}</h3>
      <label className="flex items-center justify-between py-2">
        <span>{t("adminRelease.approvalEmail")}</span>
        <input
          type="checkbox"
          checked={approval}
          onChange={(e) => setApproval(e.target.checked)}
          className="h-4 w-4 accent-primary"
        />
      </label>
      <label className="flex items-center justify-between py-2">
        <span>{t("adminRelease.rejectionEmail")}</span>
        <input
          type="checkbox"
          checked={rejection}
          onChange={(e) => setRejection(e.target.checked)}
          className="h-4 w-4 accent-primary"
        />
      </label>
      <label className="mt-2 block">
        <span className="mb-1 block text-xs text-muted-foreground">{t("adminRelease.language")}</span>
        <select
          value={lang}
          onChange={(e) => setLang(e.target.value as "sv" | "en")}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="sv">{t("language.sv")}</option>
          <option value="en">{t("language.en")}</option>
        </select>
      </label>
    </section>
  );
}