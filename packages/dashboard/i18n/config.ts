/**
 * Nafas i18n configuration
 * 3 локали: узбекский (primary), русский, английский
 */

export const locales = ["uz", "ru", "en"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "uz";

export const localeNames: Record<Locale, { native: string; latin: string; flag: string }> = {
  uz: { native: "Oʻzbekcha", latin: "Uzbek", flag: "🇺🇿" },
  ru: { native: "Русский", latin: "Russian", flag: "🇷🇺" },
  en: { native: "English", latin: "English", flag: "🇬🇧" },
};

export function isValidLocale(value: string | undefined | null): value is Locale {
  return locales.includes(value as Locale);
}
