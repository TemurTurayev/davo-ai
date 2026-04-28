"use client";

/**
 * Side panel showing always-on rule compliance.
 * Per research: amber for violations (NOT red), neutral resting state, soft pulse for active check.
 * Hidden on mobile narrow → bottom strip; visible on tablet+ as side column.
 */

import { motion } from "framer-motion";
import { Eye, Sun, User, Camera, Hand } from "lucide-react";
import { useTBControlStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const RULES_META = {
  faceInFrame: { Icon: Eye,    uz: "Yuz kadrda",    ru: "Лицо в кадре",  en: "Face in frame" },
  lighting:    { Icon: Sun,    uz: "Yorug'lik",     ru: "Освещение",     en: "Lighting" },
  singlePerson:{ Icon: User,   uz: "Bitta odam",    ru: "Один человек",  en: "Single person" },
  cameraStable:{ Icon: Camera, uz: "Kamera barqaror", ru: "Камера",       en: "Camera stable" },
  handsVisible:{ Icon: Hand,   uz: "Qo'llar",       ru: "Руки видны",    en: "Hands visible" },
} as const;

export function RulesMonitor({ locale, layout = "side" }: { locale: string; layout?: "side" | "bottom" }) {
  const { activeDose } = useTBControlStore();
  const lang = (locale === "uz" || locale === "ru" ? locale : "en") as "uz" | "ru" | "en";

  const rules = (Object.keys(RULES_META) as (keyof typeof RULES_META)[]).map((k) => ({
    key: k,
    status: activeDose.rulesStatus[k],
    ...RULES_META[k],
  }));

  if (layout === "bottom") {
    return (
      <div className="flex justify-around items-center px-2 py-2 bg-white/80 backdrop-blur rounded-2xl shadow-sm">
        {rules.map((r) => {
          const Icon = r.Icon;
          return (
            <motion.div
              key={r.key}
              animate={r.status === "ok" ? {} : { scale: [1, 1.06, 1] }}
              transition={{ duration: 1.4, repeat: Infinity }}
              className="flex flex-col items-center gap-0.5"
            >
              <div
                className={cn(
                  "w-9 h-9 rounded-xl flex items-center justify-center",
                  r.status === "ok" && "bg-[var(--color-mist)] text-[var(--color-success)]",
                  r.status === "warning" && "bg-amber-100 text-amber-600",
                  r.status === "violated" && "bg-amber-200 text-amber-700",
                )}
              >
                <Icon size={16} />
              </div>
              <span className="text-[9px] text-[var(--color-slate-500)] tabular text-center leading-tight">
                {r[lang].split(" ")[0]}
              </span>
            </motion.div>
          );
        })}
      </div>
    );
  }

  return (
    <aside className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-slate-500)] mb-2 px-1">
        {lang === "uz" ? "Holat" : lang === "ru" ? "Статус" : "Status"}
      </p>
      {rules.map((r) => {
        const Icon = r.Icon;
        return (
          <motion.div
            key={r.key}
            animate={r.status !== "ok" ? { x: [0, 2, -2, 0] } : {}}
            transition={{ duration: 0.4 }}
            className={cn(
              "flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white shadow-sm border-l-4 transition-all",
              r.status === "ok" && "border-l-transparent",
              r.status === "warning" && "border-l-amber-400",
              r.status === "violated" && "border-l-amber-600",
            )}
          >
            <Icon
              size={14}
              className={cn(
                r.status === "ok" && "text-[var(--color-success)]",
                r.status === "warning" && "text-amber-500",
                r.status === "violated" && "text-amber-700",
              )}
            />
            <span className="text-xs font-medium flex-1 truncate">
              {r[lang]}
            </span>
            {r.status === "ok" && (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-[var(--color-success)]">
                <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </motion.div>
        );
      })}
    </aside>
  );
}
