"use client";

import { usePathname } from "next/navigation";

const labels = { uz: "UZ", ru: "RU", en: "EN" } as const;

/**
 * LanguageSwitcher — uses raw <a> for FULL PAGE NAVIGATION on locale change.
 *
 * Why not next-intl <Link> or next/link? Both do client-side routing which
 * persists React's locale context + RSC prefetch cache. Clicking UZ from /en
 * could render cached EN content. Locale switch MUST tear down the React tree
 * so next-intl rebuilds with the new locale dictionary.
 *
 * Path construction (per `localePrefix: as-needed`):
 *   /en/today + UZ → /today    (uz default has no prefix)
 *   /today    + RU → /ru/today
 *   /ru/today + EN → /en/today
 */
export function LanguageSwitcher({ current }: { current: string }) {
  const pathname = usePathname();

  function pathFor(target: "uz" | "ru" | "en"): string {
    const segments = pathname.split("/").filter(Boolean);
    const head = segments[0];
    const isLocaleHead = head === "ru" || head === "en" || head === "uz";
    const tail = (isLocaleHead ? segments.slice(1) : segments).join("/");
    if (target === "uz") return tail ? `/${tail}` : "/";
    return tail ? `/${target}/${tail}` : `/${target}`;
  }

  return (
    <div className="flex items-center gap-0.5 bg-[var(--color-mist)] rounded-full p-0.5 text-xs font-semibold shadow-sm">
      {(["uz", "ru", "en"] as const).map((l) => (
        <a
          key={l}
          href={pathFor(l)}
          className={`px-2.5 py-1 rounded-full transition-colors ${
            l === current
              ? "bg-white text-[var(--color-ink)] shadow-sm"
              : "text-[var(--color-slate-500)] hover:text-[var(--color-ink)]"
          }`}
        >
          {labels[l]}
        </a>
      ))}
    </div>
  );
}
