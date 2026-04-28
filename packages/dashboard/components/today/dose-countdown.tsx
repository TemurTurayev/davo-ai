"use client";

/**
 * DoseCountdown — live countdown to next reminder time.
 * Tone: encouraging not anxious.
 */

import { useEffect, useState } from "react";

interface DoseCountdownProps {
  reminderTime: string;        // "HH:MM"
  locale: string;
}

export function DoseCountdown({ reminderTime, locale }: DoseCountdownProps) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  if (!now) return null;

  const [h, m] = reminderTime.split(":").map((s) => parseInt(s, 10));
  const target = new Date(now);
  target.setHours(h, m, 0, 0);
  // If reminder time today already passed, show "сегодня в HH:MM" with "уже" indicator
  const passed = now > target;
  if (passed) target.setDate(target.getDate() + 1);

  const diffMs = target.getTime() - now.getTime();
  const hours = Math.floor(diffMs / 1000 / 60 / 60);
  const minutes = Math.floor((diffMs / 1000 / 60) % 60);

  const labels = {
    uz: passed ? "Ertaga keyingi qabul" : "Keyingi qabul",
    ru: passed ? "Завтрашний приём" : "Следующий приём",
    en: passed ? "Tomorrow's dose" : "Next dose",
  };
  const inLabel = {
    uz: passed ? `${hours} soat ${minutes} daqiqadan keyin` : `${hours}s ${minutes}m`,
    ru: passed ? `через ${hours}ч ${minutes}м` : `через ${hours}ч ${minutes}м`,
    en: passed ? `in ${hours}h ${minutes}m` : `in ${hours}h ${minutes}m`,
  };

  const lang = (locale === "uz" || locale === "ru" ? locale : "en") as "uz" | "ru" | "en";

  return (
    <div>
      <p className="text-xs uppercase tracking-wider opacity-80 font-bold">{labels[lang]}</p>
      <p className="text-3xl font-heading font-extrabold tabular mt-0.5">{reminderTime}</p>
      <p className="text-sm opacity-90 mt-1">{inLabel[lang]}</p>
    </div>
  );
}
