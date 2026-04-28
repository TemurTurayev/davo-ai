import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Detect Telegram WebApp environment safely (SSR-safe) */
export function isTelegramWebApp(): boolean {
  if (typeof window === "undefined") return false;
  return !!(window as unknown as { Telegram?: { WebApp?: unknown } }).Telegram?.WebApp;
}

/** Format a Date as "DD month, YYYY" in given locale */
export function formatDate(d: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale === "uz" ? "uz-UZ" : locale === "ru" ? "ru-RU" : "en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

/** Day index relative to treatment start (1-based) */
export function treatmentDay(startedAt: Date, today: Date = new Date()): number {
  const ms = today.getTime() - startedAt.getTime();
  return Math.max(1, Math.floor(ms / (1000 * 60 * 60 * 24)) + 1);
}

/** Estimate end date based on regimen */
export function regimenLengthDays(regimen: "dstb" | "mdr" | "unknown"): number {
  if (regimen === "dstb") return 180;       // 6 months
  if (regimen === "mdr") return 270;        // 9 months (new all-oral)
  return 180;                                // sensible default
}
