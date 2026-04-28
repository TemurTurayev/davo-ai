"use client";

import { memo } from "react";

/**
 * Detection Log — live "console-style" feed showing what AI is doing.
 *
 * Per UX research: builds trust by showing the AI's reasoning steps
 * (similar to Aidoc / Viz.ai radiology AI triage UIs).
 *
 * For demo: this is THE component that proves to jury that AI is really
 * working, not a static mockup.
 */

import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, AlertCircle, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

interface LogEntry {
  time: number;
  message: string;
  level: "info" | "success" | "warn";
}

interface DetectionLogProps {
  entries: LogEntry[];
  /** Max entries shown (older ones drop off) */
  maxEntries?: number;
  /** "AI confidence" big number to show at top */
  confidence: number;
  /** Inferred current AI step name */
  modelName?: string;
}

export const DetectionLog = memo(DetectionLogInner);

function DetectionLogInner({
  entries,
  maxEntries = 5,
  confidence,
  modelName = "YOLO + Vision LLM",
}: DetectionLogProps) {
  const recent = entries.slice(-maxEntries);

  return (
    <div className="bg-slate-900/95 backdrop-blur rounded-2xl border border-slate-700 shadow-xl overflow-hidden">
      {/* Header — model name + live confidence */}
      <header className="px-3 py-2 border-b border-slate-700/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex w-2.5 h-2.5">
            <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
            <span className="relative rounded-full bg-emerald-400 w-2.5 h-2.5" />
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300 font-mono">
            {modelName}
          </span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className={cn(
            "text-lg font-bold tabular font-mono",
            confidence > 0.8 ? "text-emerald-400" : confidence > 0.5 ? "text-amber-400" : "text-slate-400",
          )}>
            {Math.round(confidence * 100)}
          </span>
          <span className="text-[10px] text-slate-500 font-mono">%</span>
        </div>
      </header>

      {/* Log entries */}
      <ul className="px-3 py-2 space-y-1 min-h-[110px] max-h-[140px]">
        <AnimatePresence initial={false}>
          {recent.map((entry, i) => (
            <motion.li
              key={`${entry.time}-${i}`}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1 - (recent.length - 1 - i) * 0.18, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.2 }}
              className="flex items-start gap-1.5 text-[11px] font-mono leading-tight"
            >
              <Icon level={entry.level} />
              <span className={cn(
                "flex-1 truncate",
                entry.level === "success" && "text-emerald-300",
                entry.level === "warn" && "text-amber-300",
                entry.level === "info" && "text-slate-300",
              )}>
                {entry.message}
              </span>
              <span className="text-slate-500 tabular text-[10px]">
                {(entry.time / 1000).toFixed(1)}s
              </span>
            </motion.li>
          ))}
        </AnimatePresence>
        {recent.length === 0 && (
          <li className="text-slate-500 text-[11px] font-mono italic flex items-center gap-1.5">
            <Activity size={12} className="animate-pulse" />
            Initializing AI…
          </li>
        )}
      </ul>
    </div>
  );
}

function Icon({ level }: { level: "info" | "success" | "warn" }) {
  if (level === "success")
    return <CheckCircle2 size={12} className="text-emerald-400 mt-0.5 shrink-0" />;
  if (level === "warn")
    return <AlertCircle size={12} className="text-amber-400 mt-0.5 shrink-0" />;
  return (
    <span className="w-3 h-3 mt-0.5 shrink-0 inline-flex items-center justify-center">
      <span className="w-1 h-1 rounded-full bg-slate-400" />
    </span>
  );
}
