"use client";

import { useEffect, useRef } from "react";
import { Pill } from "lucide-react";

/**
 * LongPressButton — used on the swallow step. User must hold the button until
 * progress fills, providing a deliberate confirm gesture (insulin-pump style).
 *
 * IMPORTANT: setProgress MUST be a `Dispatch<SetStateAction>` so we can pass
 * a functional updater. Earlier non-functional version was a stale-closure
 * bug — `progress` captured at render time, never advanced past initial+4.
 */
export function LongPressButton({
  label,
  onComplete,
  progress,
  setProgress,
  disabled,
}: {
  label: string;
  onComplete: () => void;
  progress: number;
  setProgress: React.Dispatch<React.SetStateAction<number>>;
  disabled?: boolean;
}) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = () => {
    if (disabled) return;
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setProgress((p) => {
        const next = Math.min(100, p + 4);
        if (next >= 100 && intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        return next;
      });
    }, 50);
  };

  const stop = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setProgress((p) => (p < 100 ? 0 : p));
  };

  useEffect(() => {
    if (progress >= 100) onComplete();
  }, [progress, onComplete]);

  return (
    <button
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      disabled={disabled}
      className="relative w-full h-14 rounded-2xl bg-amber-500 text-white font-heading font-bold text-base flex items-center justify-center gap-2 shadow-lg overflow-hidden disabled:opacity-50 select-none"
    >
      <div
        className="absolute inset-0 bg-white/20 transition-all"
        style={{ width: `${progress}%` }}
      />
      <span className="relative z-10 flex items-center gap-2">
        <Pill size={18} />
        {label}
      </span>
    </button>
  );
}
