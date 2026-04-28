"use client";

/**
 * useT — minimal i18n helper for inline trilingual strings.
 *
 * Reads locale from next-intl `useLocale()` (resolved by middleware), narrows
 * to our 3-language union, and returns:
 *  - `lang` — narrowed locale ("uz" | "ru" | "en")
 *  - `t(uz, ru, en)` — picks the matching string for current locale
 *
 * Usage:
 *   const { t, lang } = useT();
 *   <h1>{t("Salom", "Привет", "Hi")}</h1>
 *
 * Replaces the boilerplate that was copied 20+ times:
 *   const lang = (locale === "uz" || locale === "ru" ? locale : "en") as ...;
 *   const t = (uz, ru, en) => lang === "uz" ? uz : lang === "ru" ? ru : en;
 */

import { useLocale } from "next-intl";

export type Lang = "uz" | "ru" | "en";

export function useT() {
  const locale = useLocale();
  const lang: Lang =
    locale === "uz" || locale === "ru" ? (locale as Lang) : "en";

  const t = (uz: string, ru: string, en: string): string =>
    lang === "uz" ? uz : lang === "ru" ? ru : en;

  return { t, lang, locale };
}

/** Standalone helper for non-hook contexts (server components, utilities) */
export function pickByLang<T>(lang: Lang, uz: T, ru: T, en: T): T {
  return lang === "uz" ? uz : lang === "ru" ? ru : en;
}
