import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import sv from "./locales/sv.json";
import en from "./locales/en.json";

export const SUPPORTED_LANGS = ["sv", "en"] as const;
export type AppLang = (typeof SUPPORTED_LANGS)[number];

if (!i18n.isInitialized) {
  void i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources: {
        sv: { translation: sv },
        en: { translation: en },
      },
      fallbackLng: "sv",
      supportedLngs: ["sv", "en"],
      load: "languageOnly",
      nonExplicitSupportedLngs: true,
      interpolation: { escapeValue: false },
      detection: {
        order: ["localStorage", "navigator", "htmlTag"],
        lookupLocalStorage: "i18nextLng",
        caches: ["localStorage"],
      },
      returnNull: false,
    });
}

export function setAppLanguage(lang: AppLang) {
  void i18n.changeLanguage(lang);
  if (typeof document !== "undefined") {
    document.documentElement.lang = lang;
  }
}

export function currentLang(): AppLang {
  const l = (i18n.resolvedLanguage ?? i18n.language ?? "sv").slice(0, 2);
  return l === "en" ? "en" : "sv";
}

export default i18n;