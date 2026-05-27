import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Settings as SettingsIcon, Loader2, Check } from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Soundloom Core" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <ProtectedRoute>
      <SettingsPage />
    </ProtectedRoute>
  ),
});

function SettingsPage() {
  const { user } = useAuth();
  const [lang, setLang] = useState<"sv" | "en">("sv");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("preferred_language")
        .eq("user_id", user.id)
        .maybeSingle();
      const v = (data as { preferred_language?: "sv" | "en" } | null)
        ?.preferred_language;
      if (v === "sv" || v === "en") setLang(v);
      setLoading(false);
    })();
  }, [user]);

  async function save(next: "sv" | "en") {
    if (!user) return;
    setSaving(true);
    setSaved(false);
    setLang(next);
    const { error } = await supabase
      .from("profiles")
      .update({ preferred_language: next } as never)
      .eq("user_id", user.id);
    setSaving(false);
    if (!error) {
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } else {
      window.alert(error.message);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div className="mb-6 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <SettingsIcon className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-xs text-muted-foreground">Manage your account preferences.</p>
        </div>
      </div>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold">Notification language</h2>
        <p className="mb-4 text-xs text-muted-foreground">
          Used for emails and in-app notifications sent to you.
        </p>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <div className="flex gap-2">
            {(
              [
                { value: "sv" as const, label: "Svenska" },
                { value: "en" as const, label: "English" },
              ]
            ).map((opt) => (
              <button
                key={opt.value}
                disabled={saving}
                onClick={() => save(opt.value)}
                className={`rounded-md border px-3 py-1.5 text-sm transition ${
                  lang === opt.value
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
            {saved && (
              <span className="ml-2 inline-flex items-center gap-1 text-xs text-emerald-600">
                <Check className="h-3.5 w-3.5" /> Saved
              </span>
            )}
          </div>
        )}
      </section>
    </div>
  );
}