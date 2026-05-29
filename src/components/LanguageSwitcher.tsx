import { useTranslation } from "react-i18next";
import { setAppLanguage, type AppLang } from "@/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export function LanguageSwitcher({ size = "sm" }: { size?: "sm" | "md" }) {
  const { i18n, t } = useTranslation();
  const { user } = useAuth();
  const current: AppLang = (i18n.resolvedLanguage ?? i18n.language ?? "sv").startsWith("en")
    ? "en"
    : "sv";

  async function pick(lang: AppLang) {
    if (lang === current) return;
    setAppLanguage(lang);
    if (user) {
      await supabase
        .from("profiles")
        .update({ preferred_language: lang } as never)
        .eq("user_id", user.id);
    }
  }

  const padding = size === "md" ? "px-2.5 py-1.5 text-xs" : "px-2 py-1 text-[11px]";
  return (
    <div
      className="inline-flex items-center rounded-md border border-border bg-background/60 p-0.5"
      role="group"
      aria-label={t("language.switch")}
    >
      {(["sv", "en"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => void pick(l)}
          aria-pressed={current === l}
          className={`rounded ${padding} font-medium uppercase tracking-wide transition ${
            current === l
              ? "bg-secondary text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {l === "sv" ? t("language.svShort") : t("language.enShort")}
        </button>
      ))}
    </div>
  );
}