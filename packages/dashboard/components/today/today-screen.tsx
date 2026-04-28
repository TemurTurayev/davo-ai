"use client";

/**
 * Today screen — patient home in strict prescription system.
 *
 * Sections:
 *   1. Greeting + day-of-treatment badge
 *   2. Hero glass card: doctor-prescribed regimen + "Take dose" CTA or "Done today" state
 *   3. Progress arc (treatment day)
 *   4. Today's prescribed drugs strip (read-only)
 *   5. AI insight of the day
 *   6. Quick actions: Calendar, Assistant, Messages, Profile
 *
 * All medical content is doctor-prescribed; patient cannot edit anything here.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Camera, Check, Heart, Sparkles, BookOpen, Trophy, MessageCircleHeart, Lock,
  Stethoscope, Pill,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { useTBControlStore } from "@/lib/store";
import { getWebApp } from "@/lib/telegram";
import { treatmentDay } from "@/lib/utils";
import { PROTOCOLS, DRUG_LABELS } from "@/lib/protocols";
import { TBControlLogo } from "@/components/brand/tb-control-logo";
import { ProgressArc } from "./progress-arc";
import { AIInsightCard } from "./ai-insight-card";

export function TodayScreen({ locale }: { locale: string }) {
  const router = useRouter();
  const [today] = useState(() => new Date().toISOString().slice(0, 10));

  const { prescription, doses, rulesConsent, startDose } = useTBControlStore();

  const lang = (locale === "uz" || locale === "ru" ? locale : "en") as "uz" | "ru" | "en";
  const t = (uz: string, ru: string, en: string) =>
    lang === "uz" ? uz : lang === "ru" ? ru : en;

  // ALL HOOKS MUST BE CALLED UNCONDITIONALLY AT THE TOP — never after early returns.
  // Greeting (deferred to client-only to avoid hydration mismatch)
  const [greeting, setGreeting] = useState("");

  // Redirect chain: no rules consent → /rules; no prescription → /awaiting-prescription
  useEffect(() => {
    if (!rulesConsent.accepted) {
      router.replace(`/${locale}/rules`);
      return;
    }
    if (!prescription) {
      router.replace(`/${locale}/awaiting-prescription`);
    }
  }, [prescription, rulesConsent.accepted, router, locale]);

  useEffect(() => {
    const hour = new Date().getHours();
    setGreeting(
      hour < 12
        ? t("Xayrli tong", "Доброе утро", "Good morning")
        : hour < 18
        ? t("Hayrli kun", "Добрый день", "Good day")
        : t("Hayrli kech", "Добрый вечер", "Good evening"),
    );
  }, [locale]); // eslint-disable-line react-hooks/exhaustive-deps

  // Now safe to early-return after all hooks above have been called
  if (!prescription) return null;

  // Today's dose state
  const todayDose = doses.find((d) => d.scheduledAt.slice(0, 10) === today);
  const isDoseTaken = todayDose?.status === "completed" || todayDose?.status === "completed_flag";
  const isFlagged = todayDose?.status === "completed_flag";

  // Treatment day
  const startedAt = new Date(prescription.startDate);
  const dayN = treatmentDay(startedAt);
  const protocolDef = prescription.protocol !== "custom" ? PROTOCOLS[prescription.protocol] : null;
  const totalDays = protocolDef?.durationDays ?? 180;

  // Today's prescribed drugs (single dose for DS-TB)
  const todaysDose = prescription.doses[0];
  const doseTime = todaysDose?.time ?? "08:00";

  const handleStartDose = () => {
    getWebApp()?.HapticFeedback.impactOccurred("medium");
    const scheduled = new Date();
    scheduled.setHours(parseInt(doseTime.slice(0, 2)), parseInt(doseTime.slice(3, 5)), 0, 0);
    startDose(scheduled.toISOString());
    router.push(`/${locale}/dose`);
  };

  return (
    <main className="bg-aurora min-h-screen relative pb-24">
      <div className="orb orb-brand w-72 h-72 -top-20 -right-20 animate-float-slow" />
      <div className="orb orb-coral w-64 h-64 top-96 -left-16 animate-float-slow" style={{ animationDelay: "3s" }} />

      <div className="relative z-10 max-w-2xl mx-auto px-5 pt-6 pb-6">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-5 flex items-center justify-between"
        >
          <div>
            <p className="text-xs text-[var(--color-slate-500)]">{greeting},</p>
            <h1 className="font-heading font-extrabold text-xl">
              {prescription.patientName.split(" ")[0]}
            </h1>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="px-3 py-1.5 rounded-full bg-[var(--color-brand-soft)] text-[var(--color-brand-dark)] text-xs font-bold tabular">
              {t(`${dayN}/${totalDays} kun`, `${dayN}/${totalDays} день`, `Day ${dayN}/${totalDays}`)}
            </span>
          </div>
        </motion.header>

        {/* HERO: dose CTA */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          {isDoseTaken ? (
            <GlassCard variant="brand" className="p-6 mb-5 text-white text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200 }}
                className={`w-16 h-16 rounded-2xl mx-auto mb-3 flex items-center justify-center ${
                  isFlagged ? "bg-amber-400" : "bg-white/25 backdrop-blur"
                }`}
              >
                <Check size={32} strokeWidth={3} />
              </motion.div>
              <h2 className="font-heading font-extrabold text-xl mb-1">
                {isFlagged
                  ? t("Qabul qildingiz — shifokor ko'radi", "Принято — врач проверит", "Taken — doctor will review")
                  : t("Bugungi doza qabul qilindi", "Сегодняшняя доза принята", "Today's dose taken")}
              </h2>
              <p className="text-sm opacity-90">
                {t("Ertaga", "Завтра", "Tomorrow")} · {doseTime}
              </p>
            </GlassCard>
          ) : (
            <GlassCard variant="brand" className="p-6 mb-5 text-white text-center relative overflow-hidden">
              <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/15 blur-2xl" />
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl mx-auto mb-3 flex items-center justify-center bg-white/25 backdrop-blur">
                  <Pill size={32} />
                </div>
                <h2 className="font-heading font-extrabold text-xl mb-1">
                  {t("Doza vaqti", "Время дозы", "Dose time")}
                </h2>
                <p className="text-3xl font-heading font-extrabold tabular mb-3">{doseTime}</p>
                <Button
                  onClick={handleStartDose}
                  variant="secondary"
                  size="lg"
                  block
                  className="bg-white text-[var(--color-brand-dark)] hover:bg-white/95 font-bold"
                >
                  <Camera size={20} />
                  {t("Qabulni boshlash", "Начать приём", "Start dose")}
                </Button>
              </div>
            </GlassCard>
          )}
        </motion.div>

        {/* Doctor-prescribed read-only banner */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mb-5"
        >
          <div className="card flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-mist)] text-[var(--color-brand)] flex items-center justify-center shrink-0">
              <Stethoscope size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-wider font-bold text-[var(--color-slate-500)] flex items-center gap-1">
                <Lock size={10} />
                {t("Shifokor tayinladi", "Назначено врачом", "Prescribed by")}
              </p>
              <p className="font-heading font-bold text-sm">{prescription.doctorName}</p>
              <p className="text-xs text-[var(--color-slate-500)]">
                {protocolDef
                  ? protocolDef[lang === "uz" ? "nameUz" : lang === "ru" ? "nameRu" : "nameEn"]
                  : t("Maxsus rejim", "Кастомный режим", "Custom regimen")}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Today's drugs (read-only) */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-5"
        >
          <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--color-slate-500)] mb-2 px-1">
            {t("Bugun ichish kerak", "Принять сегодня", "Take today")}
          </h2>
          <div className="card">
            <div className="flex flex-wrap gap-2">
              {todaysDose?.drugs.map((drug, i) => (
                <div
                  key={i}
                  className="flex-1 min-w-[100px] px-3 py-3 rounded-xl text-white shadow-sm"
                  style={{ backgroundColor: DRUG_LABELS[drug.drugCode].color }}
                >
                  <div className="flex items-center gap-1 mb-1">
                    <Pill size={12} />
                    <span className="text-[10px] font-bold uppercase opacity-90 tabular">
                      {DRUG_LABELS[drug.drugCode].abbr}
                    </span>
                  </div>
                  <p className="font-heading font-bold text-sm leading-tight">
                    {DRUG_LABELS[drug.drugCode][lang]}
                  </p>
                  <p className="text-[10px] opacity-90 tabular mt-0.5">
                    {drug.count} × {drug.dosageMg}mg
                  </p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Progress + adherence */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="mb-5 grid grid-cols-2 gap-3"
        >
          <div className="card text-center py-4">
            <ProgressArc current={dayN} total={totalDays} size={80} />
            <p className="text-[10px] uppercase font-bold text-[var(--color-slate-500)] mt-2 tracking-wider">
              {t("Davolanish", "Лечение", "Treatment")}
            </p>
          </div>
          <div className="card text-center py-4">
            <div className="text-3xl font-heading font-extrabold text-[var(--color-success)] tabular mt-2">
              {doses.length === 0
                ? "—"
                : `${Math.round((doses.filter((d) => d.status === "completed" || d.status === "completed_flag").length / doses.length) * 100)}%`}
            </div>
            <p className="text-[10px] uppercase font-bold text-[var(--color-slate-500)] mt-2 tracking-wider">
              {t("Adherentlik", "Приверж.", "Adherence")}
            </p>
          </div>
        </motion.div>

        {/* AI insight */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-5"
        >
          <AIInsightCard locale={locale} treatmentDay={dayN} />
        </motion.div>

        {/* Quick actions */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="grid grid-cols-4 gap-2"
        >
          <QuickAction
            icon={<Sparkles size={20} />}
            label={t("AI", "AI", "AI")}
            onClick={() => router.push(`/${locale}/assistant`)}
            color="from-violet-400 to-fuchsia-500"
          />
          <QuickAction
            icon={<MessageCircleHeart size={20} />}
            label={t("Shifokor", "Врач", "Doctor")}
            onClick={() => router.push(`/${locale}/messages`)}
            color="from-pink-400 to-rose-500"
          />
          <QuickAction
            icon={<BookOpen size={20} />}
            label={t("Bilim", "Учить", "Learn")}
            onClick={() => router.push(`/${locale}/learn`)}
            color="from-amber-400 to-orange-500"
          />
          <QuickAction
            icon={<Trophy size={20} />}
            label={t("Yutuq", "Цели", "Goals")}
            onClick={() => router.push(`/${locale}/achievements`)}
            color="from-yellow-400 to-amber-500"
          />
        </motion.section>

        <footer className="text-center text-xs text-[var(--color-slate-400)] mt-8">
          <TBControlLogo size={20} className="justify-center mb-2" />
          TB Control · MindTech
        </footer>
      </div>
    </main>
  );
}

function QuickAction({
  icon,
  label,
  onClick,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  color: string;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-white shadow-sm hover:shadow-md active:scale-95 transition"
    >
      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color} text-white flex items-center justify-center shadow-md`}>
        {icon}
      </div>
      <span className="text-[11px] font-semibold text-[var(--color-slate-600)]">{label}</span>
    </button>
  );
}
