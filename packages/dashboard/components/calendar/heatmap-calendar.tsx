"use client";

/**
 * Heatmap Calendar — THE central patient UI per UX research.
 *
 * Why heatmap, not streak counter:
 * - TB treatment = 6-24 months. Streak counter creates guilt on missed days.
 * - Heatmap shows the BIG PICTURE: "how am I doing this month overall".
 * - Inspired by GitHub contributions, Apple Health, Calm.
 *
 * Cells:
 *   future    — light gray (—)
 *   today     — teal ring
 *   taken     — green (--color-success)
 *   missed    — coral (--color-danger soft)
 *   review    — amber (--color-warning soft)
 */

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { useTBControlStore } from "@/lib/store";
import { treatmentDay } from "@/lib/utils";
import { PROTOCOLS } from "@/lib/protocols";
import { getWebApp } from "@/lib/telegram";
import { cn } from "@/lib/utils";

type DayStatus = "taken" | "missed" | "review" | "today" | "future" | "before-treatment";

export function HeatmapCalendar({ locale }: { locale: string }) {
  const t = useTranslations("calendar");
  const { prescription, doses } = useTBControlStore();
  const [monthOffset, setMonthOffset] = useState(0);

  const startedAt = prescription
    ? new Date(prescription.startDate)
    : new Date();
  const totalDays = prescription && prescription.protocol !== "custom"
    ? PROTOCOLS[prescription.protocol].durationDays
    : 180;
  const treatmentEnd = new Date(startedAt);
  treatmentEnd.setDate(treatmentEnd.getDate() + totalDays);

  // Compute month grid
  const monthGrid = useMemo(() => {
    const ref = new Date();
    ref.setDate(1);
    ref.setMonth(ref.getMonth() + monthOffset);
    const year = ref.getFullYear();
    const month = ref.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Start week on Monday (Uzbek/Russian convention)
    const firstWeekday = (firstDay.getDay() + 6) % 7;

    const cells: { date: Date | null; iso?: string; status?: DayStatus }[] = [];

    // Padding from prev month
    for (let i = 0; i < firstWeekday; i++) cells.push({ date: null });

    const today = new Date();
    const todayIso = today.toISOString().slice(0, 10);

    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(year, month, d);
      const iso = date.toISOString().slice(0, 10);
      const dose = doses.find((dd) => dd.scheduledAt.slice(0, 10) === iso);

      let status: DayStatus = "future";
      if (date < startedAt) status = "before-treatment";
      else if (iso === todayIso) status = "today";
      else if (date > today) status = "future";
      else if (dose?.status === "completed") status = "taken";
      else if (dose?.status === "completed_flag") status = "review";
      else status = "missed";

      cells.push({ date, iso, status });
    }

    return { year, month, cells };
  }, [monthOffset, doses, startedAt]);

  // Stats for current view
  const stats = useMemo(() => {
    let taken = 0, missed = 0, total = 0;
    for (const cell of monthGrid.cells) {
      if (!cell.date) continue;
      if (cell.status === "taken") taken++;
      else if (cell.status === "missed") missed++;
      if (cell.status === "taken" || cell.status === "missed") total++;
    }
    return { taken, missed, total };
  }, [monthGrid]);

  const monthLabel = monthGrid.cells.find((c) => c.date)?.date?.toLocaleDateString(
    locale === "uz" ? "uz-UZ" : locale === "ru" ? "ru-RU" : "en-US",
    { month: "long", year: "numeric" },
  ) ?? "";

  const weekdayLabels = locale === "uz"
    ? ["Du", "Se", "Cho", "Pa", "Ju", "Sh", "Ya"]
    : locale === "ru"
    ? ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
    : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const navigate = (delta: number) => {
    getWebApp()?.HapticFeedback.selectionChanged();
    setMonthOffset((m) => m + delta);
  };

  // Treatment progress
  const dayN = treatmentDay(startedAt);
  const progressPct = Math.min(100, Math.round((dayN / totalDays) * 100));

  return (
    <main className="max-w-2xl mx-auto px-5 pt-6 pb-6">
      {/* Treatment progress card */}
      <section className="card mb-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--color-brand-soft)] flex items-center justify-center">
            <Sparkles size={20} className="text-[var(--color-brand)]" />
          </div>
          <div className="flex-1">
            <h2 className="font-heading font-bold text-base">
              {locale === "uz" ? "Davolash yo'li" : locale === "ru" ? "Путь лечения" : "Treatment journey"}
            </h2>
            <p className="text-xs text-[var(--color-slate-500)] tabular">
              {locale === "uz"
                ? `${dayN} / ${totalDays} kun`
                : locale === "ru"
                ? `${dayN} / ${totalDays} дней`
                : `Day ${dayN} of ${totalDays}`}
            </p>
          </div>
          <span className="text-2xl font-heading font-extrabold tabular text-[var(--color-brand)]">
            {progressPct}%
          </span>
        </div>
        <div className="h-2 bg-[var(--color-mist)] rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--color-brand)] rounded-full transition-[width] duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </section>

      {/* Calendar */}
      <section className="card">
        {/* Month nav */}
        <header className="flex items-center justify-between mb-4">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full hover:bg-[var(--color-mist)] flex items-center justify-center"
          >
            <ChevronLeft size={20} />
          </button>
          <h2 className="font-heading font-bold capitalize">{monthLabel}</h2>
          <button
            onClick={() => navigate(1)}
            disabled={monthOffset >= 0}
            className="w-9 h-9 rounded-full hover:bg-[var(--color-mist)] flex items-center justify-center disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronRight size={20} />
          </button>
        </header>

        {/* Stats */}
        {stats.total > 0 && (
          <p className="text-sm text-[var(--color-slate-500)] mb-4 text-center">
            {locale === "uz" && `${stats.taken} kun qabul qilindi · ${stats.missed} pauza`}
            {locale === "ru" && `${stats.taken} дней приёма · ${stats.missed} пауза`}
            {locale === "en" && `${stats.taken} days taken · ${stats.missed} missed`}
          </p>
        )}

        {/* Weekday header */}
        <div className="grid grid-cols-7 gap-1.5 mb-2">
          {weekdayLabels.map((d) => (
            <div key={d} className="text-center text-xs font-medium text-[var(--color-slate-400)]">
              {d}
            </div>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-7 gap-1.5">
          {monthGrid.cells.map((cell, idx) => {
            if (!cell.date) {
              return <div key={idx} className="aspect-square" />;
            }
            return (
              <div
                key={idx}
                className={cn(
                  "aspect-square rounded-lg flex items-center justify-center text-sm font-semibold tabular relative transition-transform hover:scale-110",
                  statusBg(cell.status!),
                  statusText(cell.status!),
                  cell.status === "today" && "ring-2 ring-[var(--color-brand)] ring-offset-1",
                )}
                title={cell.iso}
              >
                {cell.date.getDate()}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-3 mt-5 flex-wrap">
          <LegendItem color="bg-[var(--color-success)]" label={t("legend_taken")} />
          <LegendItem color="bg-[rgba(239,68,68,0.4)]" label={t("legend_missed")} />
          <LegendItem color="bg-[rgba(245,158,11,0.4)]" label={locale === "uz" ? "Tekshirish" : locale === "ru" ? "На проверке" : "Review"} />
          <LegendItem color="bg-[var(--color-brand-soft)] ring-2 ring-[var(--color-brand)]" label={t("legend_today")} />
        </div>
      </section>
    </main>
  );
}

function statusBg(status: DayStatus): string {
  switch (status) {
    case "taken": return "bg-[var(--color-success)]";
    case "missed": return "bg-[rgba(239,68,68,0.4)]";
    case "review": return "bg-[rgba(245,158,11,0.4)]";
    case "today": return "bg-[var(--color-brand-soft)]";
    case "future": return "bg-[var(--color-mist)]";
    case "before-treatment": return "bg-transparent";
    default: return "bg-[var(--color-mist)]";
  }
}

function statusText(status: DayStatus): string {
  switch (status) {
    case "taken": return "text-white";
    case "missed": case "review": return "text-[var(--color-ink)]";
    case "today": return "text-[var(--color-brand-dark)] font-extrabold";
    case "future": return "text-[var(--color-slate-400)]";
    case "before-treatment": return "text-[var(--color-slate-300)]";
    default: return "text-[var(--color-slate-400)]";
  }
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-[var(--color-slate-500)]">
      <span className={cn("w-3 h-3 rounded", color)} />
      <span>{label}</span>
    </div>
  );
}
