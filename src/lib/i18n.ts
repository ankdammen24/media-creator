export const defaultLocale = "sv" as const;
export const supportedLocales = ["sv", "en"] as const;
export type SupportedLocale = (typeof supportedLocales)[number];

const sv = {
  appName: "Media Creator",
  sourceOfTruth: "Backend är källa till sanning. Den här portalen visar bara API:ets status.",
};

const en: typeof sv = {
  appName: "Media Creator",
  sourceOfTruth: "The backend is the source of truth. This portal only displays API state.",
};

export const messages = { sv, en };

export function t(key: keyof typeof sv, locale: SupportedLocale = defaultLocale) {
  return messages[locale][key];
}
