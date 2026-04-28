/**
 * Locale routing middleware
 * - / → /uz (default)
 * - /ru, /en, /uz preserved
 * - Telegram WebApp passes language hint, we honor it
 */

import createMiddleware from "next-intl/middleware";
import { locales, defaultLocale } from "./i18n/config";

export default createMiddleware({
  locales: locales as unknown as string[],
  defaultLocale,
  localePrefix: "as-needed", // / → uz (no /uz/), /ru, /en
  localeDetection: true,
});

export const config = {
  matcher: [
    // Match all paths except API, static files, internal Next.js
    "/((?!api|_next|_vercel|.*\\..*).*)",
  ],
};
