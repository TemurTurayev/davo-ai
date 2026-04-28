"use client";

/**
 * ProgressArc — circular progress visualizing treatment journey.
 * Shows current day / total days as ring with gradient stroke.
 */

import { motion } from "framer-motion";

interface ProgressArcProps {
  current: number;
  total: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  sublabel?: string;
}

export function ProgressArc({
  current,
  total,
  size = 200,
  strokeWidth = 14,
  label,
  sublabel,
}: ProgressArcProps) {
  const pct = Math.min(1, current / total);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - pct);

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id="progress-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="#0EA5A4" />
            <stop offset="60%"  stopColor="#14B8A6" />
            <stop offset="100%" stopColor="#F59E5B" />
          </linearGradient>
        </defs>
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(15, 23, 42, 0.08)"
          strokeWidth={strokeWidth}
        />
        {/* Progress */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#progress-grad)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: dashOffset }}
          transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>

      {/* Center label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-5xl font-heading font-extrabold tabular text-[var(--color-ink)]">
          {Math.round(pct * 100)}<span className="text-2xl text-[var(--color-slate-500)]">%</span>
        </span>
        {label && (
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-slate-500)] mt-1">
            {label}
          </span>
        )}
        {sublabel && (
          <span className="text-xs tabular text-[var(--color-slate-400)] mt-0.5">
            {sublabel}
          </span>
        )}
      </div>
    </div>
  );
}
