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
  // Disabled: was redirecting Russian-browser users away from explicit /uz clicks
  // (Accept-Language ru → / would bounce to /ru, breaking the language switcher).
  // Target audience is Uzbekistan; default uz, let user pick via LanguageSwitcher.
  localeDetection: false,
});

export const config = {
  matcher: [
    // Match all paths except API, static files, internal Next.js, AND `/ai/*`
    // (which is rewritten in next.config.ts to the Pro M4 Pro AI proxy).
    "/((?!api|_next|_vercel|ai/|.*\\..*).*)",
  ],
};
