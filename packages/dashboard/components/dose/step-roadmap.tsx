"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import { Check, Circle, ChevronRight } from "lucide-react";
import { STEP_META, DOSE_STEP_ORDER } from "@/lib/dose-step-meta";
import type { DoseFlowStep } from "@/lib/store";
import { cn } from "@/lib/utils";

/**
 * Step roadmap — vertical list of all 8 dose-flow steps with state:
 *   ✓ done    — emerald check
 *   ● current — pulsing brand dot, bold title
 *   ○ upcoming — slate dot, dim title
 *
 * Shown in the side panel so the user always sees what's coming next without
 * having to memorize the 8 steps. Per UX research (step-gated medical procedures):
 * 'show progress chunked with explicit next-step hint'.
 */
export const StepRoadmap = memo(StepRoadmapInner);

function StepRoadmapInner({
  currentStep,
  lang,
}: {
  currentStep: DoseFlowStep;
  lang: "uz" | "ru" | "en";
}) {
  const steps = DOSE_STEP_ORDER.filter(
    (s): s is Exclude<DoseFlowStep, "completed"> => s !== "completed",
  );
  // currentStep can briefly be "completed" during finalize transition;
  // indexOf returns -1, which renders as "after-last" (all steps done)
  const currentIdx = steps.indexOf(currentStep as Exclude<DoseFlowStep, "completed">);
  const titleKey = `title${lang === "uz" ? "Uz" : lang === "ru" ? "Ru" : "En"}` as
    | "titleUz"
    | "titleRu"
    | "titleEn";

  const headerLabel = lang === "uz" ? "Bosqichlar" : lang === "ru" ? "Этапы приёма" : "Steps";

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-3">
      <p className="text-[10px] uppercase font-bold text-slate-400 mb-2 font-mono">
        {headerLabel} · {currentIdx + 1}/{steps.length}
      </p>
      <ol className="space-y-1.5">
        {steps.map((step, i) => {
          const meta = STEP_META[step];
          if (!meta) return null;
          const done = i < currentIdx;
          const current = i === currentIdx;
          const Icon = meta.icon;
          return (
            <motion.li
              key={step}
              animate={current ? { x: [0, 2, 0] } : {}}
              transition={{ duration: 0.6, repeat: current ? Infinity : 0, repeatDelay: 1.5 }}
              className={cn(
                "flex items-center gap-2 text-xs leading-tight rounded-lg px-2 py-1.5 transition-colors",
                current && "bg-[var(--color-brand)]/15 ring-1 ring-[var(--color-brand)]/40",
              )}
            >
              {/* Step indicator */}
              <span
                className={cn(
                  "shrink-0 w-5 h-5 rounded-full flex items-center justify-center font-bold tabular text-[10px]",
                  done && "bg-emerald-500/20 text-emerald-400",
                  current && "bg-[var(--color-brand)] text-white shadow-md shadow-[var(--color-brand)]/40",
                  !done && !current && "bg-slate-800 text-slate-500",
                )}
              >
                {done ? <Check size={11} strokeWidth={3} /> : i + 1}
              </span>

              {/* Step icon — slightly visible context */}
              <Icon
                size={11}
                className={cn(
                  "shrink-0",
                  done && "text-emerald-400",
                  current && "text-[var(--color-brand)]",
                  !done && !current && "text-slate-600",
                )}
              />

              {/* Step title */}
              <span
                className={cn(
                  "flex-1 truncate",
                  done && "text-slate-400 line-through decoration-emerald-500/30",
                  current && "text-white font-bold",
                  !done && !current && "text-slate-500",
                )}
              >
                {meta[titleKey]}
              </span>

              {/* Arrow on current */}
              {current && (
                <ChevronRight size={12} className="shrink-0 text-[var(--color-brand)] animate-pulse" />
              )}
            </motion.li>
          );
        })}
      </ol>
    </div>
  );
}
