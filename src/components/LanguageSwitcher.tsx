import { useTranslation } from "react-i18next";
import { setAppLanguage, SUPPORTED_LANGS, type AppLang } from "@/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export function LanguageSwitcher({ size = "sm" }: { size?: "sm" | "md" }) {
  const { i18n, t } = useTranslation();
  const { user } = useAuth();
  const raw = (i18n.resolvedLanguage ?? i18n.language ?? "sv").slice(0, 2);
  const current: AppLang = (SUPPORTED_LANGS as readonly string[]).includes(raw)
    ? (raw as AppLang)
    : "sv";

  async function pick(lang: AppLang) {
    const next = lang as AppLang;
    if (lang === current) return;
    setAppLanguage(next);
    if (user) {
      await supabase
        .from("profiles")
        .update({ preferred_language: next } as never)
        .eq("user_id", user.id);
    }
  }

  const padding = size === "md" ? "px-2 py-1.5 text-xs" : "px-1.5 py-1 text-[11px]";
  return (
    <div
      className="inline-flex flex-wrap items-center gap-0.5 rounded-md border border-border bg-background/60 p-0.5"
      role="group"
      aria-label={t("language.switch")}
    >
      {SUPPORTED_LANGS.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => void pick(l)}
          aria-pressed={current === l}
          title={t(`language.${l}`)}
          className={`rounded ${padding} font-medium uppercase tracking-wide transition ${
            current === l
              ? "bg-secondary text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {t(`language.${l}Short`)}
        </button>
      ))}
    </div>
  );
}