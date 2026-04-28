/**
 * next-intl server-side configuration
 * Loads dictionaries based on resolved locale.
 */

import { getRequestConfig } from "next-intl/server";
import { locales, defaultLocale, isValidLocale, type Locale } from "./config";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale: Locale = isValidLocale(requested) ? requested : defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});

export { locales, defaultLocale };
