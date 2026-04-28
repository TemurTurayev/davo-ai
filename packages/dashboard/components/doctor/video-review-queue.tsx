"use client";

/**
 * Doctor Video Review Queue.
 * Shows red-flagged dose recordings for spot-check.
 * Doctor can: approve (green flag) → counts as adherent
 *              reject  (confirm red flag) → counts as suspicious
 *
 * Per research (radiology AI triage UI patterns):
 *  - Sort by AI confidence ascending (lowest = top of queue)
 *  - Show AI reasoning + flag types
 *  - Bulk approve for clearly-OK cases
 *  - Speed control on video, auto-skip to flagged moments (future)
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  Check,
  X,
  AlertTriangle,
  Clock,
  Eye,
  Filter,
  Stethoscope,
} from "lucide-react";
import { useTBControlStore } from "@/lib/store";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Demo: synth queue of red-flagged doses (in real app: fetched from server)
const DEMO_QUEUE = [
  {
    id: "demo-1",
    patient: "Sardor T.",
    flagType: "swallow_uncertain",
    flagNote: "AI confidence 47% on swallow detection",
    timestamp: "2 hours ago",
    aiConfidence: 0.47,
  },
  {
    id: "demo-2",
    patient: "Madina K.",
    flagType: "face_mismatch",
    flagNote: "Face similarity 58% — below 65% threshold",
    timestamp: "5 hours ago",
    aiConfidence: 0.58,
  },
  {
    id: "demo-3",
    patient: "Rustam B.",
    flagType: "pill_mismatch",
    flagNote: "Detected 3 pills, prescribed 4",
    timestamp: "yesterday 18:30",
    aiConfidence: 0.62,
  },
  {
    id: "demo-4",
    patient: "Aziza M.",
    flagType: "rule_violation",
    flagNote: "Face out of frame for 4 seconds during open_box",
    timestamp: "yesterday 08:15",
    aiConfidence: 0.71,
  },
];

const FLAG_LABELS = {
  uz: {
    swallow_uncertain: "Yutish noaniq",
    face_mismatch: "Yuz mos kelmadi",
    pill_mismatch: "Tabletkalar soni",
    mouth_unclear: "Og'iz noaniq",
    connection_lost: "Aloqa uzildi",
    rule_violation: "Qoida buzilishi",
  },
  ru: {
    swallow_uncertain: "Глотание неуверенно",
    face_mismatch: "Несовпадение лица",
    pill_mismatch: "Несовпадение таблеток",
    mouth_unclear: "Рот не виден",
    connection_lost: "Связь потеряна",
    rule_violation: "Нарушение правил",
  },
  en: {
    swallow_uncertain: "Swallow uncertain",
    face_mismatch: "Face mismatch",
    pill_mismatch: "Pill mismatch",
    mouth_unclear: "Mouth unclear",
    connection_lost: "Connection lost",
    rule_violation: "Rule violation",
  },
};

export function VideoReviewQueue({ locale }: { locale: string }) {
  const router = useRouter();
  const { doses } = useTBControlStore();

  const lang = (locale === "uz" || locale === "ru" ? locale : "en") as "uz" | "ru" | "en";
  const t = (uz: string, ru: string, en: string) =>
    lang === "uz" ? uz : lang === "ru" ? ru : en;

  // Combine demo queue + real flagged doses
  const realFlagged = useMemo(
    () => doses.filter((d) => d.status === "completed_flag" && !d.doctorReviewed),
    [doses],
  );

  const [reviewed, setReviewed] = useState<Record<string, "approved" | "rejected">>({});

  const queue = [
    ...realFlagged.map((d) => ({
      id: d.id,
      patient: t("Bemor (siz)", "Пациент (вы)", "Patient (you)"),
      flagType: d.flags[0]?.type ?? "rule_violation",
      flagNote: d.flags[0]?.note ?? "",
      timestamp: new Date(d.completedAt ?? d.scheduledAt).toLocaleString(
        lang === "uz" ? "uz-UZ" : lang === "ru" ? "ru-RU" : "en-US",
      ),
      aiConfidence: d.aiVerification.faceMatch ?? 0.5,
    })),
    ...DEMO_QUEUE,
  ].sort((a, b) => a.aiConfidence - b.aiConfidence);

  const decide = (id: string, verdict: "approved" | "rejected") => {
    setReviewed((prev) => ({ ...prev, [id]: verdict }));
  };

  return (
    <main className="bg-aurora min-h-screen relative overflow-hidden pb-12">
      <div className="orb orb-coral w-72 h-72 -top-20 -right-20 animate-float-slow" />

      <div className="relative z-10 max-w-3xl mx-auto px-5 pt-6 pb-6">
        <header className="flex items-center gap-3 mb-5">
          <button
            onClick={() => router.push(`/${locale}/doctor`)}
            className="w-9 h-9 rounded-full bg-white/80 backdrop-blur shadow-sm flex items-center justify-center"
          >
            <ChevronLeft size={18} />
          </button>
          <div>
            <h1 className="font-heading font-extrabold text-2xl">
              {t("Tekshirish navbati", "Очередь проверки", "Review queue")}
            </h1>
            <p className="text-xs text-[var(--color-slate-500)]">
              {t(
                "AI shubhali deb belgilagan video yozuvlar",
                "Видеозаписи, отмеченные ИИ как сомнительные",
                "Videos AI flagged as uncertain",
              )}
            </p>
          </div>
        </header>

        {/* Stats banner */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <GlassCard className="p-4 text-center">
            <p className="text-3xl font-heading font-extrabold tabular text-amber-600">
              {queue.length}
            </p>
            <p className="text-[10px] uppercase font-bold tracking-wider text-[var(--color-slate-500)] mt-1">
              {t("Kutmoqda", "Ожидают", "Pending")}
            </p>
          </GlassCard>
          <GlassCard className="p-4 text-center">
            <p className="text-3xl font-heading font-extrabold tabular text-[var(--color-success)]">
              {Object.values(reviewed).filter((v) => v === "approved").length}
            </p>
            <p className="text-[10px] uppercase font-bold tracking-wider text-[var(--color-slate-500)] mt-1">
              {t("Tasdiqlangan", "Одобрено", "Approved")}
            </p>
          </GlassCard>
          <GlassCard className="p-4 text-center">
            <p className="text-3xl font-heading font-extrabold tabular text-[var(--color-danger)]">
              {Object.values(reviewed).filter((v) => v === "rejected").length}
            </p>
            <p className="text-[10px] uppercase font-bold tracking-wider text-[var(--color-slate-500)] mt-1">
              {t("Rad etilgan", "Отклонено", "Rejected")}
            </p>
          </GlassCard>
        </div>

        {/* Queue */}
        <div className="space-y-3">
          {queue.map((item, idx) => {
            const decided = reviewed[item.id];
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
              >
                <GlassCard
                  className={cn(
                    "p-4",
                    decided === "approved" && "opacity-50",
                    decided === "rejected" && "opacity-50 ring-2 ring-[var(--color-danger)]",
                  )}
                >
                  <div className="flex items-start gap-3">
                    {/* Video thumb stand-in */}
                    <div className="w-20 h-20 rounded-xl bg-slate-800 flex items-center justify-center shrink-0 relative overflow-hidden">
                      <Eye size={24} className="text-white/60" />
                      <span className="absolute top-1 right-1 px-1 py-0.5 rounded bg-amber-500 text-white text-[8px] font-bold">
                        {Math.round(item.aiConfidence * 100)}%
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-heading font-bold text-sm">{item.patient}</h3>
                        <span className="text-[10px] text-[var(--color-slate-400)] flex items-center gap-0.5">
                          <Clock size={10} />
                          {item.timestamp}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <AlertTriangle size={12} className="text-amber-600" />
                        <span className="text-xs font-semibold text-amber-700">
                          {FLAG_LABELS[lang][item.flagType as keyof typeof FLAG_LABELS["en"]]}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--color-slate-500)] leading-relaxed">
                        {item.flagNote}
                      </p>
                    </div>
                  </div>

                  {!decided ? (
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      <button
                        onClick={() => decide(item.id, "approved")}
                        className="py-2 rounded-xl bg-[var(--color-success)] text-white font-bold text-sm flex items-center justify-center gap-1.5 hover:opacity-90"
                      >
                        <Check size={16} />
                        {t("Yashil bayroq", "Зелёный флаг", "Green flag")}
                      </button>
                      <button
                        onClick={() => decide(item.id, "rejected")}
                        className="py-2 rounded-xl bg-[var(--color-danger)] text-white font-bold text-sm flex items-center justify-center gap-1.5 hover:opacity-90"
                      >
                        <X size={16} />
                        {t("Tasdiqlash", "Подтвердить", "Confirm flag")}
                      </button>
                    </div>
                  ) : (
                    <p className={cn(
                      "mt-3 text-center text-sm font-bold py-2 rounded-xl",
                      decided === "approved"
                        ? "bg-[var(--color-success)]/10 text-[var(--color-success)]"
                        : "bg-[var(--color-danger)]/10 text-[var(--color-danger)]",
                    )}>
                      {decided === "approved"
                        ? t("✓ Yashil bayroq berildi", "✓ Зелёный флаг", "✓ Green-flagged")
                        : t("✗ Qizil bayroq tasdiqlandi", "✗ Красный флаг подтверждён", "✗ Red flag confirmed")}
                    </p>
                  )}
                </GlassCard>
              </motion.div>
            );
          })}

          {queue.length === 0 && (
            <GlassCard className="p-8 text-center">
              <Stethoscope size={40} className="mx-auto mb-3 text-[var(--color-success)]" />
              <p className="font-heading font-bold text-lg">
                {t("Hammasi tekshirildi", "Всё проверено", "All reviewed")}
              </p>
              <p className="text-sm text-[var(--color-slate-500)] mt-1">
                {t("Yangi shubhali video yo'q.", "Нет новых сомнительных видео.", "No new uncertain videos.")}
              </p>
            </GlassCard>
          )}
        </div>
      </div>
    </main>
  );
}
