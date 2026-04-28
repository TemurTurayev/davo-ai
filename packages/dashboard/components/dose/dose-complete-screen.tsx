"use client";

/**
 * Dose Complete — celebration screen after successful flow.
 * Shows: result (green check or amber flag), AI verdict summary, next dose ETA.
 *
 * Per research: don't celebrate streaks (guilt risk for 6mo treatment),
 * celebrate the SINGLE dose with grateful, calm tone.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { CheckCircle2, AlertTriangle, ArrowRight, Sparkles } from "lucide-react";
import { useTBControlStore } from "@/lib/store";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";

export function DoseCompleteScreen({ locale }: { locale: string }) {
  const router = useRouter();
  const { doses } = useTBControlStore();

  const lang = (locale === "uz" || locale === "ru" ? locale : "en") as "uz" | "ru" | "en";
  const t = (uz: string, ru: string, en: string) =>
    lang === "uz" ? uz : lang === "ru" ? ru : en;

  // Latest dose
  const lastDose = [...doses]
    .filter((d) => d.completedAt)
    .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""))[0];

  const flagged = lastDose?.status === "completed_flag";

  useEffect(() => {
    if (!lastDose) {
      router.replace(`/${locale}/today`);
    }
  }, [lastDose, router, locale]);

  if (!lastDose) return null;

  return (
    <main className="bg-aurora min-h-screen relative flex flex-col">
      <div className="orb orb-mint w-72 h-72 -top-20 -left-20 animate-float-slow" />

      <section className="relative z-10 flex-1 flex flex-col justify-center px-5 max-w-md mx-auto w-full">
        <motion.div
          initial={{ scale: 0, rotate: -10 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 180 }}
          className={`w-28 h-28 rounded-3xl mx-auto mb-5 flex items-center justify-center shadow-xl ${
            flagged
              ? "bg-gradient-to-br from-amber-400 to-amber-600"
              : "bg-gradient-to-br from-emerald-400 to-teal-500"
          }`}
        >
          {flagged ? (
            <AlertTriangle size={48} className="text-white" strokeWidth={2.5} />
          ) : (
            <CheckCircle2 size={56} className="text-white" strokeWidth={2.5} />
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-center mb-5"
        >
          <h1 className="font-heading font-extrabold text-3xl mb-2">
            {flagged
              ? t("Dorini qabul qildingiz", "Доза принята", "Dose taken")
              : t("Ajoyib!", "Отлично!", "Great!")}
          </h1>
          <p className="text-[var(--color-slate-600)] leading-relaxed">
            {flagged
              ? t(
                  "AI ba'zi qadamlarda ishonchsizlik aniqladi. Shifokoringiz videoni ko'rib chiqadi va tasdiqlaydi.",
                  "ИИ отметил неуверенность на некоторых шагах. Ваш врач посмотрит видео и подтвердит.",
                  "AI flagged some steps as uncertain. Your doctor will review the video and confirm.",
                )
              : t(
                  "Bugungi doza muvaffaqiyatli qabul qilindi. Davom eting!",
                  "Сегодняшняя доза успешно принята. Продолжайте в том же духе!",
                  "Today's dose successfully recorded. Keep going!",
                )}
          </p>
        </motion.div>

        {/* AI verdict summary */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <GlassCard className="p-4 mb-3">
            <p className="text-[10px] uppercase tracking-wider font-bold text-[var(--color-slate-500)] mb-2">
              {t("AI hisoboti", "Отчёт ИИ", "AI report")}
            </p>
            <div className="space-y-1.5 text-sm">
              <RowItem
                label={t("Yuz aniqlandi", "Лицо распознано", "Face recognized")}
                ok={lastDose.aiVerification.faceMatch !== null && lastDose.aiVerification.faceMatch > 0.65}
                value={
                  lastDose.aiVerification.faceMatch
                    ? `${Math.round(lastDose.aiVerification.faceMatch * 100)}%`
                    : "—"
                }
              />
              <RowItem
                label={t("Tabletkalar soni", "Кол-во таблеток", "Pill count")}
                ok={lastDose.aiVerification.pillCount !== null && lastDose.aiVerification.pillCount > 0}
                value={lastDose.aiVerification.pillCount?.toString() ?? "—"}
              />
              <RowItem
                label={t("Yutilganligi", "Проглочено", "Swallowed")}
                ok={lastDose.aiVerification.swallowDetected ?? false}
                value={lastDose.aiVerification.swallowDetected ? "✓" : "?"}
              />
              <RowItem
                label={t("Og'iz bo'sh", "Рот пуст", "Mouth empty")}
                ok={lastDose.aiVerification.mouthEmpty ?? false}
                value={lastDose.aiVerification.mouthEmpty ? "✓" : "?"}
              />
            </div>
            {lastDose.flags.length > 0 && (
              <div className="mt-3 pt-3 border-t border-[var(--color-slate-200)]">
                <p className="text-xs text-amber-700 font-semibold mb-1">
                  {t(
                    `Bayroqlar: ${lastDose.flags.length}`,
                    `Флажков: ${lastDose.flags.length}`,
                    `Flags: ${lastDose.flags.length}`,
                  )}
                </p>
                <p className="text-xs text-[var(--color-slate-500)]">
                  {t(
                    "Shifokor ko'rib chiqadi va yashil belgilashi mumkin.",
                    "Врач проверит и может пометить зелёным.",
                    "Doctor will review and may mark green.",
                  )}
                </p>
              </div>
            )}
          </GlassCard>
        </motion.div>

        {/* Encouragement */}
        {!flagged && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <GlassCard variant="brand" className="p-4 mb-3 text-white">
              <div className="flex gap-2">
                <Sparkles size={18} className="shrink-0 mt-0.5" />
                <p className="text-sm leading-relaxed">
                  {t(
                    "Har doza — sog'liq sari qadam. Shifokoringiz va biz siz bilan birgamiz.",
                    "Каждый приём — шаг к выздоровлению. Ваш врач и мы рядом с вами.",
                    "Every dose is a step toward recovery. Your doctor and we are with you.",
                  )}
                </p>
              </div>
            </GlassCard>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Button onClick={() => router.push(`/${locale}/today`)} block size="lg">
            {t("Bosh sahifaga", "На главную", "Back to home")}
            <ArrowRight size={18} />
          </Button>
        </motion.div>
      </section>
    </main>
  );
}

function RowItem({ label, ok, value }: { label: string; ok: boolean; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[var(--color-slate-600)]">{label}</span>
      <span className={`font-bold tabular ${ok ? "text-[var(--color-success)]" : "text-amber-600"}`}>
        {value}
      </span>
    </div>
  );
}
