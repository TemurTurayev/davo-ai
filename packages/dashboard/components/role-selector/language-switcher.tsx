"use client";

import Link from "next/link";

const labels = { uz: "UZ", ru: "RU", en: "EN" } as const;

export function LanguageSwitcher({ current }: { current: string }) {
  return (
    <div className="flex items-center gap-0.5 bg-[var(--color-mist)] rounded-full p-0.5 text-xs font-semibold shadow-sm">
      {(["uz", "ru", "en"] as const).map((l) => (
        <Link
          key={l}
          href={`/${l}`}
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
