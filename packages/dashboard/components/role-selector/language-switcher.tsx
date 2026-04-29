"use client";

import { Link, usePathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/config";

const labels: Record<Locale, string> = { uz: "UZ", ru: "RU", en: "EN" };

/**
 * LanguageSwitcher — uses next-intl's locale-aware Link.
 *
 * `usePathname()` from next-intl returns the path WITHOUT the locale prefix
 * (so "/en/today" appears as "/today"). Passing the same path to <Link locale="X">
 * generates the correct target URL per `as-needed` policy:
 *   locale="uz" → "/today"     (default, no prefix)
 *   locale="ru" → "/ru/today"
 *   locale="en" → "/en/today"
 *
 * This is more robust than the manual string-stripping we used before — it
 * handles edge cases (cookie sync, prefetch invalidation, route groups) that
 * raw `next/link` doesn't.
 */
export function LanguageSwitcher({ current }: { current: string }) {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-0.5 bg-[var(--color-mist)] rounded-full p-0.5 text-xs font-semibold shadow-sm">
      {(["uz", "ru", "en"] as const).map((l) => (
        <Link
          key={l}
          href={pathname}
          locale={l}
          className={`px-2.5 py-1 rounded-full transition-colors ${
            l === current
              ? "bg-white text-[var(--color-ink)] shadow-sm"
              : "text-[var(--color-slate-500)] hover:text-[var(--color-ink)]"
          }`}
        >
          {labels[l]}
        </Link>
      ))}
    </div>
  );
}
