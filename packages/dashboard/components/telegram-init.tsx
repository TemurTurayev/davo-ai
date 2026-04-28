"use client";

/**
 * TelegramInit — client-side WebApp bootstrap.
 * - Calls WebApp.ready() so Telegram knows we're loaded
 * - Calls WebApp.expand() so the modal takes full viewport
 * - Applies theme params to CSS vars
 * - Auto-redirects to user's preferred locale if outside one
 */

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  getWebApp,
  applyTelegramTheme,
  mapTelegramLanguage,
} from "@/lib/telegram";
import { locales, isValidLocale } from "@/i18n/config";

export function TelegramInit() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const webApp = getWebApp();
    if (!webApp) return;

    try {
      webApp.ready();
      webApp.expand();
      applyTelegramTheme(webApp.themeParams);

      // Auto-redirect to user's preferred locale on first load (only if at root)
      const userLang = mapTelegramLanguage(webApp.initDataUnsafe.user?.language_code);
      const segments = pathname.split("/").filter(Boolean);
      const currentLocale = segments[0];

      if (!isValidLocale(currentLocale) && pathname === "/") {
        router.replace(`/${userLang}`);
      }
    } catch (e) {
      console.error("[Nafas] Telegram WebApp init failed:", e);
    }
  }, [pathname, router]);

  return null;
}
