"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const labels = { uz: "UZ", ru: "RU", en: "EN" } as const;

/**
 * LanguageSwitcher — preserves current pathname when switching locales.
 * /ru/today + click UZ → /today (uz is default, no prefix per `localePrefix: as-needed`)
 * /today + click RU → /ru/today
 * Without this, all clicks bounced to / (root).
 */
export function LanguageSwitcher({ current }: { current: string }) {
  const pathname = usePathname();

  function pathFor(target: "uz" | "ru" | "en"): string {
    // Strip leading locale segment if any
    const segments = pathname.split("/").filter(Boolean);
    const head = segments[0];
    const isLocaleHead = head === "ru" || head === "en" || head === "uz";
    const rest = isLocaleHead ? segments.slice(1) : segments;
    const tail = rest.join("/");

    // uz is default → no prefix in URL (as-needed)
    if (target === "uz") return tail ? `/${tail}` : "/";
    return tail ? `/${target}/${tail}` : `/${target}`;
  }

  return (
    <div className="flex items-center gap-0.5 bg-[var(--color-mist)] rounded-full p-0.5 text-xs font-semibold shadow-sm">
      {(["uz", "ru", "en"] as const).map((l) => (
        <Link
          key={l}
          href={pathFor(l)}
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
