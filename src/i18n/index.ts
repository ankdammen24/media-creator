import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import sv from "./locales/sv.json";
import en from "./locales/en.json";
import no from "./locales/no.json";
import da from "./locales/da.json";
import fi from "./locales/fi.json";
import is from "./locales/is.json";

export const SUPPORTED_LANGS = ["sv", "en", "no", "da", "fi", "is"] as const;
export type AppLang = (typeof SUPPORTED_LANGS)[number];

if (!i18n.isInitialized) {
  void i18n
    .use(initReactI18next)
    .init({
      resources: {
        sv: { translation: sv },
        en: { translation: en },
        no: { translation: no },
        da: { translation: da },
        fi: { translation: fi },
        is: { translation: is },
      },
      lng: "sv",
      fallbackLng: "sv",
      supportedLngs: ["sv", "en", "no", "da", "fi", "is"],
      load: "languageOnly",
      initAsync: false,
      nonExplicitSupportedLngs: true,
      interpolation: { escapeValue: false },
      returnNull: false,
    });
}

export function setAppLanguage(lang: AppLang) {
  void i18n.changeLanguage(lang);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem("i18nextLng", lang);
    } catch {
      /* ignore */
    }
  }
  if (typeof document !== "undefined") {
    document.documentElement.lang = lang;
  }
}

export function currentLang(): AppLang {
  const l = (i18n.resolvedLanguage ?? i18n.language ?? "sv").slice(0, 2);
  return (SUPPORTED_LANGS as readonly string[]).includes(l) ? (l as AppLang) : "sv";
}

export default i18n;