"use client";

/**
 * Today screen — main patient view (premium glassmorphism redesign)
 *
 * Sections:
 *   1. Greeting + treatment day badge
 *   2. Hero glass card (gradient brand) — countdown / "dose taken" state + Record CTA
 *   3. Progress arc + KPI strip (medications)
 *   4. Last 7 days mini-heatmap (glass card)
 *   5. AI insight of the day
 *   6. Quick actions grid (4 actions)
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import {
  Camera, Check, Heart, Sparkles, BookOpen, Trophy, MessageCircleHeart,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { useTBControlStore } from "@/lib/store";
import { getWebApp } from "@/lib/telegram";
import { treatmentDay, regimenLengthDays } from "@/lib/utils";
import { TBControlLogo } from "@/components/brand/tb-control-logo";
import { ProgressArc } from "./progress-arc";
import { DoseCountdown } from "./dose-countdown";
import { MedicationStrip } from "./medication-strip";
import { AIInsightCard } from "./ai-insight-card";

export function TodayScreen({ locale }: { locale: string }) {
  const router = useRouter();
  const t = useTranslations("daily");
  const [today] = useState(() => new Date().toISOString().slice(0, 10));

  const { profile, doses, isOnboarded } = useTBControlStore();

  useEffect(() => {
    if (!isOnboarded) router.push(`/${locale}/onboarding`);
  }, [isOnboarded, router, locale]);

  const todayDose = doses.find((d) => d.date === today);
  const isDoseTaken = todayDose?.status === "taken";

  const startedAt = profile.treatmentStartedAt ? new Date(profile.treatmentStartedAt) : new Date();
  const dayN = treatmentDay(startedAt);
  const total = regimenLengthDays(profile.regimen);

  // Recent 7 days adherence
  const recent7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const iso = d.toISOString().slice(0, 10);
    const dose = doses.find((dd) => dd.date === iso);
    return {
      date: iso,
      day: d.getDate(),
      weekday: d.toLocaleDateString(locale === "uz" ? "uz-UZ" : locale === "ru" ? "ru-RU" : "en-US", { weekday: "short" }),
      status: dose?.status ?? (iso === today ? "today" : "future"),
    };
  });

  const onRecord = () => {
    getWebApp()?.HapticFeedback.impactOccurred("medium");
    router.push(`/${locale}/today/record`);
  };

  const drugs = profile.regimen === "dstb"
    ? ["rifampicin", "isoniazid", "pyrazinamide", "ethambutol"]
    : profile.regimen === "mdr"
      ? ["bedaquiline", "linezolid", "moxifloxacin"]
      : ["combo_fdc"];

  return (
    <main className="bg-aurora min-h-screen relative">
      {/* Decorative orbs */}
      <div className="orb orb-teal w-72 h-72 -left-24 -top-24 animate-float-slow" />
      <div className="orb orb-coral w-64 h-64 -right-20 top-32 animate-float-slow" style={{ animationDelay: "3s" }} />
      <div className="orb orb-indigo w-48 h-48 left-12 bottom-32 opacity-30" />

      <div className="relative px-5 pt-6 pb-8 z-10">
        {/* Greeting */}
        <motion.header
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-5"
        >
          <div>
            <p className="text-sm text-[var(--color-slate-500)]">
              {greeting(locale)}, {profile.fullName.split(" ")[0] || ""}
            </p>
            <p className="text-xs tabular text-[var(--color-slate-400)] mt-0.5">
              {t("day_of", { current: dayN, total })}
            </p>
          </div>
          <TBControlLogo size={32} />
        </motion.header>

        {/* Hero — gradient glass with countdown / verified state */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <GlassCard
            variant={isDoseTaken ? "accent" : "brand"}
            className="relative overflow-hidden p-6 mb-5"
          >
            <div className="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-white/15 animate-pulse-soft" />
            <div className="absolute -right-2 -bottom-12 w-40 h-40 rounded-full bg-white/10" />

            <div className="relative flex items-start gap-4">
              <div className="flex-1 min-w-0">
                {isDoseTaken ? (
                  <>
                    <div className="flex items-center gap-2 mb-2">
                      <Check size={18} />
                      <span className="text-xs uppercase tracking-wider font-bold opacity-90">
                        {t("verified")}
                      </span>
                    </div>
                    <h1 className="text-2xl font-heading font-extrabold leading-tight mb-1">
                      {localize(locale, {
                        uz: "Bugungi doza qabul qilindi",
                        ru: "Доза на сегодня принята",
                        en: "Today's dose is done",
                      })}
                    </h1>
                    <p className="text-sm opacity-90">
                      {localize(locale, {
                        uz: "Davom eting. Sog'lik qaytmoqda.",
                        ru: "Продолжайте. Здоровье возвращается.",
                        en: "Keep going. Health is returning.",
                      })}
                    </p>
                  </>
                ) : (
                  <DoseCountdown reminderTime={profile.reminderTime} locale={locale} />
                )}

                {!isDoseTaken && (
                  <Button
                    onClick={onRecord}
                    className="mt-5 bg-white text-[var(--color-brand-dark)] hover:bg-white shadow-lg hover:shadow-xl"
                  >
                    <Camera size={20} />
                    {t("record_button")}
                  </Button>
                )}
              </div>
            </div>
          </GlassCard>
        </motion.section>

        {/* Progress arc + medication strip */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-4 mb-5"
        >
          <GlassCard className="flex items-center justify-center">
            <ProgressArc
              current={dayN}
              total={total}
              size={180}
              label={localize(locale, { uz: "Yo'l bosildi", ru: "Пройдено", en: "Complete" })}
              sublabel={`${dayN} / ${total} ${localize(locale, { uz: "kun", ru: "дн", en: "days" })}`}
            />
          </GlassCard>

          <div className="flex flex-col gap-4">
            <GlassCard>
              <MedicationStrip drugs={drugs} locale={locale} />
            </GlassCard>

            <Glass7DayHeatmap data={recent7} locale={locale} />
          </div>
        </motion.section>

        {/* AI insight */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mb-5"
        >
          <AIInsightCard locale={locale} treatmentDay={dayN} />
        </motion.section>

        {/* Quick actions grid */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-2 gap-3"
        >
          <QuickAction
            icon={<MessageCircleHeart />}
            tone="accent"
            title={localize(locale, { uz: "Yon ta'sirlar", ru: "Побочки", en: "Side effects" })}
            sub={localize(locale, { uz: "Maslahat oling", ru: "Получить совет", en: "Get advice" })}
            onClick={() => router.push(`/${locale}/chat`)}
          />
          <QuickAction
            icon={<BookOpen />}
            tone="brand"
            title={localize(locale, { uz: "Bilim", ru: "Знания", en: "Learn" })}
            sub={localize(locale, { uz: "Dorilar haqida", ru: "О препаратах", en: "About drugs" })}
            onClick={() => router.push(`/${locale}/learn`)}
          />
          <QuickAction
            icon={<Trophy />}
            tone="indigo"
            title={localize(locale, { uz: "Yutuqlar", ru: "Достижения", en: "Achievements" })}
            sub={localize(locale, { uz: "Sizning bosqichlaringiz", ru: "Ваши вехи", en: "Your milestones" })}
            onClick={() => router.push(`/${locale}/achievements`)}
          />
          <QuickAction
            icon={<Heart />}
            tone="rose"
            title={localize(locale, { uz: "Shifokor", ru: "Врач", en: "Doctor" })}
            sub={localize(locale, { uz: "Yozishish", ru: "Написать", en: "Message" })}
            onClick={() => router.push(`/${locale}/messages`)}
          />
        </motion.section>
      </div>
    </main>
  );
}

/* ── Subcomponents ─────────────────────────────────────── */

function Glass7DayHeatmap({
  data,
  locale,
}: {
  data: { date: string; day: number; weekday: string; status: string }[];
  locale: string;
}) {
  const titleMap = {
    uz: "Oxirgi 7 kun",
    ru: "Последние 7 дней",
    en: "Last 7 days",
  };
  const lang = (locale === "uz" || locale === "ru" ? locale : "en") as "uz" | "ru" | "en";

  return (
    <GlassCard>
      <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-slate-500)] mb-3">
        {titleMap[lang]}
      </p>
      <div className="flex items-end justify-between gap-1.5">
        {data.map((d, i) => (
          <motion.div
            key={d.date}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.04 }}
            className="flex-1 flex flex-col items-center gap-1.5"
          >
            <div
              className="w-full aspect-square rounded-md"
              style={{
                background:
                  d.status === "taken" ? "var(--color-success)" :
                  d.status === "missed" ? "rgba(239,68,68,0.5)" :
                  d.status === "today" ? "var(--color-brand-soft)" :
                  "var(--color-mist)",
                boxShadow: d.status === "today" ? "0 0 0 2px var(--color-brand)" : "none",
              }}
            />
            <span className="text-[10px] tabular text-[var(--color-slate-500)] font-medium">
              {d.day}
            </span>
          </motion.div>
        ))}
      </div>
    </GlassCard>
  );
}

function QuickAction({
  icon,
  tone,
  title,
  sub,
  onClick,
}: {
  icon: React.ReactNode;
  tone: "brand" | "accent" | "indigo" | "rose";
  title: string;
  sub: string;
  onClick: () => void;
}) {
  const toneMap = {
    brand: { bg: "from-[var(--color-brand)]/15 to-[var(--color-brand)]/5", icon: "text-[var(--color-brand)]" },
    accent: { bg: "from-[var(--color-accent)]/15 to-[var(--color-accent)]/5", icon: "text-[var(--color-accent)]" },
    indigo: { bg: "from-indigo-500/15 to-indigo-500/5", icon: "text-indigo-500" },
    rose: { bg: "from-rose-500/15 to-rose-500/5", icon: "text-rose-500" },
  } as const;

  return (
    <button
      onClick={() => {
        getWebApp()?.HapticFeedback.selectionChanged();
        onClick();
      }}
      className="glass text-left hover:scale-[1.02] active:scale-[0.99] transition-transform"
    >
      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${toneMap[tone].bg} flex items-center justify-center mb-2`}>
        <span className={toneMap[tone].icon}>{icon}</span>
      </div>
      <h3 className="font-heading font-bold text-sm">{title}</h3>
      <p className="text-xs text-[var(--color-slate-500)] mt-0.5">{sub}</p>
    </button>
  );
}

function greeting(locale: string): string {
  const hour = new Date().getHours();
  if (locale === "uz") {
    if (hour < 12) return "Xayrli tong";
    if (hour < 17) return "Xayrli kun";
    return "Xayrli kech";
  }
  if (locale === "ru") {
    if (hour < 12) return "Доброе утро";
    if (hour < 17) return "Добрый день";
    return "Добрый вечер";
  }
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function localize(locale: string, m: { uz: string; ru: string; en: string }): string {
  return locale === "uz" ? m.uz : locale === "ru" ? m.ru : m.en;
}
