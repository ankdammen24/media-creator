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

  async function pick(next: AppLang) {
    if (next === current) return;
    setAppLanguage(next);
    if (user) {
      await supabase
        .from("profiles")
        .update({ preferred_language: next } as never)
        .eq("user_id", user.id);
    }
  }

  const sizing =
    size === "md"
      ? "h-9 pl-2.5 pr-7 text-xs"
      : "h-8 pl-2 pr-6 text-[11px]";

  return (
    <div className="relative inline-flex items-center">
      <select
        aria-label={t("language.switch")}
        value={current}
        onChange={(e) => void pick(e.target.value as AppLang)}
        className={`appearance-none rounded-md border border-border bg-background/60 ${sizing} font-medium uppercase tracking-wide text-foreground transition hover:bg-secondary focus:outline-none focus:ring-1 focus:ring-ring`}
      >
        {SUPPORTED_LANGS.map((l) => (
          <option key={l} value={l} className="normal-case">
            {t(`language.${l}`)}
          </option>
        ))}
      </select>
      <svg
        aria-hidden
        viewBox="0 0 20 20"
        className="pointer-events-none absolute right-1.5 h-3 w-3 text-muted-foreground"
      >
        <path d="M5 7l5 6 5-6" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}