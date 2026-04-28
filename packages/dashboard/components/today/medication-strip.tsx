"use client";

/**
 * MedicationStrip — visual breakdown of today's pills.
 * Shows pill icons (color-coded by drug) + count.
 */

import { Pill } from "lucide-react";
import { cn } from "@/lib/utils";

const DRUG_COLOR: Record<string, { bg: string; ring: string; label: string }> = {
  rifampicin:    { bg: "bg-rose-500",   ring: "ring-rose-200",   label: "R" },
  isoniazid:     { bg: "bg-slate-100",  ring: "ring-slate-300",  label: "H" },
  pyrazinamide:  { bg: "bg-stone-200",  ring: "ring-stone-300",  label: "Z" },
  ethambutol:    { bg: "bg-amber-300",  ring: "ring-amber-200",  label: "E" },
  combo_fdc:     { bg: "bg-pink-400",   ring: "ring-pink-200",   label: "RHZE" },
  moxifloxacin:  { bg: "bg-blue-300",   ring: "ring-blue-200",   label: "M" },
  bedaquiline:   { bg: "bg-purple-300", ring: "ring-purple-200", label: "B" },
  linezolid:     { bg: "bg-emerald-300",ring: "ring-emerald-200",label: "L" },
};

interface MedicationStripProps {
  drugs: string[];
  locale: string;
}

const DRUG_NAMES: Record<string, Record<string, string>> = {
  rifampicin:   { uz: "Rifampitsin",  ru: "Рифампицин",  en: "Rifampicin" },
  isoniazid:    { uz: "Izoniazid",    ru: "Изониазид",    en: "Isoniazid" },
  pyrazinamide: { uz: "Pirazinamid",  ru: "Пиразинамид",  en: "Pyrazinamide" },
  ethambutol:   { uz: "Etambutol",    ru: "Этамбутол",    en: "Ethambutol" },
  combo_fdc:    { uz: "RHZE Kombo",   ru: "RHZE Комбо",   en: "RHZE Combo" },
};

export function MedicationStrip({ drugs, locale }: MedicationStripProps) {
  const lang = (locale === "uz" || locale === "ru" ? locale : "en") as "uz" | "ru" | "en";
  const total = drugs.length;
  const titleMap = {
    uz: `Bugungi dozalar (${total})`,
    ru: `Сегодняшние препараты (${total})`,
    en: `Today's medications (${total})`,
  };

  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-slate-500)] mb-3">
        {titleMap[lang]}
      </p>

      <div className="flex flex-wrap gap-2">
        {drugs.map((d) => {
          const cfg = DRUG_COLOR[d] ?? { bg: "bg-slate-300", ring: "ring-slate-200", label: "?" };
          const name = DRUG_NAMES[d]?.[lang] ?? d;
          return (
            <div
              key={d}
              className="flex items-center gap-2 pr-3 pl-1 py-1 rounded-full bg-white/70 backdrop-blur-sm border border-[var(--color-slate-200)]"
            >
              <span
                className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-extrabold ring-2",
                  cfg.bg,
                  cfg.ring,
                )}
              >
                {cfg.label}
              </span>
              <span className="text-sm font-medium">{name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
