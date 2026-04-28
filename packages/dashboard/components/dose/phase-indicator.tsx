"use client";

import { memo } from "react";

/**
 * Phase indicator — bottom progress visualization.
 * 3 phases (Identify → Verify → Ingest) × dots per step.
 * Per research: phase grouping beats linear bar / full list on mobile.
 */

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DoseFlowStep } from "@/lib/store";

const PHASE_STEPS: { phase: 1 | 2 | 3; steps: DoseFlowStep[] }[] = [
  { phase: 1, steps: ["face_id", "show_box"] },
  { phase: 2, steps: ["open_box", "show_pills", "pill_closeup", "show_glass"] },
  { phase: 3, steps: ["swallow", "mouth_check"] },
];

const PHASE_LABELS = {
  uz: ["Aniqlash", "Tekshirish", "Qabul"],
  ru: ["Идент.", "Проверка", "Приём"],
  en: ["Identify", "Verify", "Ingest"],
};

const ALL_STEPS: DoseFlowStep[] = [
  "face_id", "show_box",
  "open_box", "show_pills", "pill_closeup", "show_glass",
  "swallow", "mouth_check",
];

export const PhaseIndicator = memo(PhaseIndicatorInner);

function PhaseIndicatorInner({
  currentStep,
  locale,
}: {
  currentStep: DoseFlowStep;
  locale: string;
}) {
  const lang = (locale === "uz" || locale === "ru" ? locale : "en") as "uz" | "ru" | "en";
  const currentIdx = ALL_STEPS.indexOf(currentStep);

  return (
    <div className="flex items-center justify-center gap-3 px-3 py-2.5 bg-white/85 backdrop-blur rounded-2xl shadow-sm">
      {PHASE_STEPS.map((phase, pi) => {
        const stepStartIdx = ALL_STEPS.indexOf(phase.steps[0]);
        const stepEndIdx = ALL_STEPS.indexOf(phase.steps[phase.steps.length - 1]);
        const phaseDone = currentIdx > stepEndIdx;
        const phaseActive = currentIdx >= stepStartIdx && currentIdx <= stepEndIdx;

        return (
          <div key={phase.phase} className="flex items-center gap-2 first:pl-0">
            <div className="flex items-center gap-1">
              {phase.steps.map((s, si) => {
                const idx = ALL_STEPS.indexOf(s);
                const completed = currentIdx > idx;
                const current = currentIdx === idx;
                return (
                  <motion.div
                    key={s}
                    animate={current ? { scale: [1, 1.2, 1] } : {}}
                    transition={{ duration: 1.2, repeat: Infinity }}
                    className={cn(
                      "rounded-full transition-all",
                      completed && "w-2 h-2 bg-[var(--color-success)]",
                      current && "w-3 h-3 bg-[var(--color-brand)] shadow-md shadow-[var(--color-brand)]/40",
                      !completed && !current && "w-2 h-2 bg-[var(--color-slate-300)]",
                    )}
                    style={{ transitionDelay: `${si * 30}ms` }}
                  />
                );
              })}
            </div>
            <span
              className={cn(
                "text-[10px] font-semibold uppercase tracking-wider tabular",
                phaseDone && "text-[var(--color-success)]",
                phaseActive && "text-[var(--color-brand)]",
                !phaseDone && !phaseActive && "text-[var(--color-slate-400)]",
              )}
            >
              {phaseDone ? <Check size={11} className="inline" /> : `${pi + 1}.`}
              {" "}{PHASE_LABELS[lang][pi]}
            </span>
          </div>
        );
      })}
    </div>
  );
}
