"use client";

/**
 * Achievements — Strava-style milestones with confetti reveal.
 * Per research: replace streak counters (guilt) with positive milestones.
 */

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Flame, Sparkles, Medal, Star, ShieldCheck, HeartHandshake } from "lucide-react";
import { useTBControlStore } from "@/lib/store";
import { treatmentDay, regimenLengthDays } from "@/lib/utils";
import { GlassCard } from "@/components/ui/glass-card";
import { cn } from "@/lib/utils";

interface Milestone {
  id: string;
  threshold: number;             // days needed
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
  title: { uz: string; ru: string; en: string };
  body: { uz: string; ru: string; en: string };
}

const MILESTONES: Milestone[] = [
  {
    id: "first_dose",
    threshold: 1,
    icon: Sparkles,
    color: "from-emerald-400 to-teal-500",
    title: { uz: "Birinchi qadam", ru: "Первый шаг", en: "First step" },
    body: {
      uz: "Birinchi dozani qabul qildingiz. Yo'l boshlandi.",
      ru: "Вы приняли первую дозу. Путь начался.",
      en: "You took your first dose. The journey has begun.",
    },
  },
  {
    id: "week_one",
    threshold: 7,
    icon: Flame,
    color: "from-orange-400 to-rose-500",
    title: { uz: "Birinchi hafta", ru: "Первая неделя", en: "First week" },
    body: {
      uz: "7 kun davomida o'zingizga g'amxo'rlik qildingiz. Bu odat shakllanyapti.",
      ru: "7 дней — вы заботились о себе. Привычка формируется.",
      en: "7 days of self-care. The habit is forming.",
    },
  },
  {
    id: "month_one",
    threshold: 30,
    icon: Medal,
    color: "from-amber-400 to-orange-500",
    title: { uz: "Bir oy", ru: "Один месяц", en: "One month" },
    body: {
      uz: "Bir oylik mehnat. Aktiv bakteriya kamida 90% kamaygan.",
      ru: "Месяц упорства. Активные бактерии снизились минимум на 90%.",
      en: "A month of dedication. Active bacteria reduced by at least 90%.",
    },
  },
  {
    id: "intensive_phase",
    threshold: 60,
    icon: ShieldCheck,
    color: "from-blue-400 to-indigo-500",
    title: {
      uz: "Intensiv bosqich tugadi",
      ru: "Интенсивная фаза завершена",
      en: "Intensive phase complete",
    },
    body: {
      uz: "2 oy o'tdi. Endi qo'llab-quvvatlash bosqichi — yengilroq, ammo muhim.",
      ru: "2 месяца позади. Поддерживающая фаза — легче, но важна.",
      en: "2 months done. Continuation phase — easier, but vital.",
    },
  },
  {
    id: "halfway",
    threshold: 90,
    icon: Star,
    color: "from-purple-400 to-pink-500",
    title: { uz: "Yarim yo'l", ru: "Половина пути", en: "Halfway" },
    body: {
      uz: "Yo'lning yarmidasiz. Eng qiyini orqada qoldi.",
      ru: "Вы прошли половину пути. Самое сложное — позади.",
      en: "You've crossed the halfway point. The hardest part is behind.",
    },
  },
  {
    id: "complete",
    threshold: 180,
    icon: Trophy,
    color: "from-yellow-400 to-amber-500",
    title: {
      uz: "Davolanish yakuni",
      ru: "Лечение завершено",
      en: "Treatment complete",
    },
    body: {
      uz: "Sog'lom! Bu sizning g'alabangiz. Albatta, oxirgi tahlilni o'tkazing.",
      ru: "Вы здоровы! Это ваша победа. Обязательно сдайте контрольный анализ.",
      en: "You're well! This is your victory. Don't forget the follow-up test.",
    },
  },
];

export function AchievementsScreen({ locale }: { locale: string }) {
  const lang = (locale === "uz" || locale === "ru" ? locale : "en") as "uz" | "ru" | "en";
  const { profile } = useTBControlStore();

  const dayN = useMemo(() => {
    const startedAt = profile.treatmentStartedAt
      ? new Date(profile.treatmentStartedAt)
      : new Date();
    return treatmentDay(startedAt);
  }, [profile.treatmentStartedAt]);

  const totalDays = regimenLengthDays(profile.regimen);

  const earned = MILESTONES.filter((m) => dayN >= m.threshold);
  const next = MILESTONES.find((m) => dayN < m.threshold);

  const [openMilestone, setOpenMilestone] = useState<string | null>(null);

  const titleMap = {
    uz: "Yutuqlaringiz",
    ru: "Ваши достижения",
    en: "Your achievements",
  };

  return (
    <main className="bg-aurora min-h-screen relative">
      <div className="orb orb-coral w-72 h-72 -right-20 top-20 animate-float-slow" />

      <div className="relative px-5 pt-6 pb-8 z-10">
        <header className="mb-6">
          <h1 className="font-heading font-extrabold text-2xl mb-1">{titleMap[lang]}</h1>
          <p className="text-sm text-[var(--color-slate-500)]">
            {lang === "uz" && `Davolanish kuni ${dayN} / ${totalDays}`}
            {lang === "ru" && `День лечения ${dayN} / ${totalDays}`}
            {lang === "en" && `Treatment day ${dayN} of ${totalDays}`}
          </p>
        </header>

        {/* Hero stat — earned count */}
        <GlassCard variant="brand" className="mb-5 p-6 text-center">
          <p className="text-xs uppercase tracking-wider opacity-90 font-bold mb-1">
            {lang === "uz" && "G'alaba qozonilgan bosqichlar"}
            {lang === "ru" && "Достигнутые вехи"}
            {lang === "en" && "Milestones earned"}
          </p>
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-5xl font-heading font-extrabold tabular">{earned.length}</span>
            <span className="text-2xl opacity-75 font-heading">/ {MILESTONES.length}</span>
          </div>
          {next && (
            <p className="mt-2 text-sm opacity-90">
              {lang === "uz" && `Keyingisi: ${next.threshold - dayN} kundan keyin`}
              {lang === "ru" && `До следующей: ${next.threshold - dayN} дн.`}
              {lang === "en" && `Next milestone in ${next.threshold - dayN} days`}
            </p>
          )}
        </GlassCard>

        {/* Milestones grid */}
        <section className="grid grid-cols-2 gap-3">
          {MILESTONES.map((m, idx) => {
            const isEarned = dayN >= m.threshold;
            const Icon = m.icon;
            return (
              <motion.button
                key={m.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.05 }}
                onClick={() => setOpenMilestone(m.id)}
                className={cn(
                  "relative p-4 rounded-2xl text-left transition-transform active:scale-95",
                  isEarned
                    ? "bg-white shadow-md hover:shadow-lg"
                    : "bg-white/40 border border-dashed border-[var(--color-slate-300)]",
                )}
              >
                {/* Decorative glow if earned */}
                {isEarned && (
                  <div className={`absolute -top-3 -right-3 w-12 h-12 rounded-full bg-gradient-to-br ${m.color} blur-xl opacity-50`} />
                )}

                <div
                  className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center mb-3 shrink-0",
                    isEarned
                      ? `bg-gradient-to-br ${m.color} text-white shadow-md`
                      : "bg-[var(--color-mist)] text-[var(--color-slate-400)]",
                  )}
                >
                  <Icon size={22} />
                </div>

                <h3 className={cn(
                  "font-heading font-bold text-sm mb-0.5",
                  isEarned ? "text-[var(--color-ink)]" : "text-[var(--color-slate-500)]",
                )}>
                  {m.title[lang]}
                </h3>
                <p className="text-xs text-[var(--color-slate-500)] tabular">
                  {lang === "uz" && `${m.threshold} kun`}
                  {lang === "ru" && `${m.threshold} дн.`}
                  {lang === "en" && `${m.threshold} days`}
                </p>

                {isEarned && (
                  <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-[var(--color-success)] flex items-center justify-center">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
              </motion.button>
            );
          })}
        </section>

        {/* Modal — milestone detail */}
        <AnimatePresence>
          {openMilestone && (
            <MilestoneModal
              milestone={MILESTONES.find((m) => m.id === openMilestone)!}
              isEarned={dayN >= (MILESTONES.find((m) => m.id === openMilestone)?.threshold ?? 0)}
              lang={lang}
              dayN={dayN}
              onClose={() => setOpenMilestone(null)}
            />
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}

function MilestoneModal({
  milestone,
  isEarned,
  lang,
  dayN,
  onClose,
}: {
  milestone: Milestone;
  isEarned: boolean;
  lang: "uz" | "ru" | "en";
  dayN: number;
  onClose: () => void;
}) {
  const Icon = milestone.icon;
  const remaining = Math.max(0, milestone.threshold - dayN);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-md p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: "spring", stiffness: 280, damping: 30 }}
        className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6 text-center relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Confetti orbs (decorative) */}
        {isEarned && (
          <>
            <div className={`absolute -top-12 -left-8 w-32 h-32 rounded-full bg-gradient-to-br ${milestone.color} blur-3xl opacity-40`} />
            <div className={`absolute -bottom-12 -right-8 w-40 h-40 rounded-full bg-gradient-to-br ${milestone.color} blur-3xl opacity-30`} />
          </>
        )}

        <div className="relative">
          <motion.div
            initial={{ scale: 0, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200 }}
            className={cn(
              "w-24 h-24 rounded-3xl mx-auto mb-4 flex items-center justify-center",
              isEarned
                ? `bg-gradient-to-br ${milestone.color} text-white shadow-xl`
                : "bg-[var(--color-mist)] text-[var(--color-slate-400)]",
            )}
          >
            <Icon size={42} />
          </motion.div>

          <h2 className="text-2xl font-heading font-extrabold mb-2">{milestone.title[lang]}</h2>

          {isEarned ? (
            <p className="text-[var(--color-slate-700)] leading-relaxed">{milestone.body[lang]}</p>
          ) : (
            <p className="text-[var(--color-slate-500)] leading-relaxed">
              {lang === "uz" && `Bu bosqichni ochish uchun yana ${remaining} kun kerak`}
              {lang === "ru" && `До этой вехи осталось ${remaining} дней`}
              {lang === "en" && `${remaining} days until this milestone`}
            </p>
          )}

          <button
            onClick={onClose}
            className="mt-6 w-full h-12 rounded-xl bg-[var(--color-brand)] text-white font-semibold"
          >
            {lang === "uz" && "Yopish"}
            {lang === "ru" && "Закрыть"}
            {lang === "en" && "Close"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
