export const defaultLocale = "sv" as const;
export const supportedLocales = ["sv", "en"] as const;
export type SupportedLocale = (typeof supportedLocales)[number];

const sv = {
  appName: "Crystal Pier Records Creator Portal",
  appNameShort: "Crystal Pier Records",
  appTagline: "Creator Portal",
  sidebarSubtitle: "Independent label portal",
  dashboardTitle: "Crystal Pier Dashboard",
  dashboardIntro: "Upload your music, complete your metadata, and follow your release from processing to distribution.",
  authTitle: "Sign in to Crystal Pier Records Creator Portal",
  authSubtitle: "Manage your uploads, tracks, releases, and distribution status.",
  footer: "Crystal Pier Records is part of Media Rosenqvist.",
  sourceOfTruth: "Backend är källa till sanning. Den här portalen visar bara API:ets status.",
};

const en: typeof sv = { ...sv };

export const messages = { sv, en };

export function t(key: keyof typeof sv, locale: SupportedLocale = defaultLocale) {
  return messages[locale][key];
}
