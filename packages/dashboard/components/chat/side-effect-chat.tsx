"use client";

/**
 * Side Effect Chat — constrained tree (per UX research, like K Health).
 *
 * Why constrained instead of free-text:
 * 1. Safer medically (predictable inputs)
 * 2. Easier for patients (no typing burden)
 * 3. Structured data for doctor (easier triage)
 *
 * Flow:
 *   Q1: Как вы себя чувствуете?
 *      → Хорошо → "Записал. Берегите себя."
 *      → Есть жалоба → Q2
 *   Q2: Какая часть тела?
 *      → 6 categories
 *   Q3 (optional): Voice/text describe details
 *   → AI triage → severity + advice
 *   → Save to store
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Heart,
  Smile,
  Pill,
  Eye,
  Battery,
  Bone,
  HelpCircle,
  Shapes,
  Mic,
  Send,
  AlertTriangle,
  Check,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useTBControlStore } from "@/lib/store";
import { getWebApp } from "@/lib/telegram";

type Step = "feeling" | "category" | "describe" | "advice" | "saved";
type Severity = "low" | "medium" | "high" | "emergency";

interface AdviceResult {
  severity: Severity;
  advice: string;
  escalate: boolean;
}

const CATEGORIES = [
  { id: "stomach", icon: Pill, key: "stomach" },
  { id: "skin", icon: Heart, key: "skin" },
  { id: "vision", icon: Eye, key: "vision" },
  { id: "energy", icon: Battery, key: "energy" },
  { id: "joints", icon: Bone, key: "joints" },
  { id: "other", icon: Shapes, key: "other" },
] as const;

export function SideEffectChat({ locale }: { locale: string }) {
  const router = useRouter();
  const t = useTranslations("side_effects");

  const [step, setStep] = useState<Step>("feeling");
  const [category, setCategory] = useState<string>("");
  const [description, setDescription] = useState("");
  const [advice, setAdvice] = useState<AdviceResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { recordSideEffect } = useTBControlStore();

  const haptic = (s: "light" | "medium" = "light") =>
    getWebApp()?.HapticFeedback.impactOccurred(s);

  const onFeelGood = () => {
    haptic("light");
    recordSideEffect({
      occurredAt: new Date().toISOString(),
      category: "wellness",
      text: locale === "uz" ? "Yaxshi" : locale === "ru" ? "Хорошо" : "Doing well",
      severity: "low",
      escalated: false,
    });
    getWebApp()?.HapticFeedback.notificationOccurred("success");
    setStep("saved");
    setTimeout(() => router.push(`/${locale}/today`), 1500);
  };

  const onComplaint = () => {
    haptic("light");
    setStep("category");
  };

  const onCategorySelect = (id: string) => {
    haptic("light");
    setCategory(id);
    setStep("describe");
  };

  const onSubmit = async () => {
    if (!description.trim()) return;
    setSubmitting(true);
    haptic("medium");

    // Mock triage — in production, POST to /api/triage which calls LLM
    // For now, do client-side red-flag detection
    const result = mockTriage(description, locale);
    setAdvice(result);

    recordSideEffect({
      occurredAt: new Date().toISOString(),
      category,
      text: description,
      severity: result.severity,
      advice: result.advice,
      escalated: result.escalate,
    });

    setSubmitting(false);
    setStep("advice");

    if (result.severity === "emergency" || result.severity === "high") {
      getWebApp()?.HapticFeedback.notificationOccurred("warning");
    } else {
      getWebApp()?.HapticFeedback.notificationOccurred("success");
    }
  };

  return (
    <main className="px-5 pt-6 pb-6">
      <header className="mb-6">
        <h1 className="font-heading font-extrabold text-2xl">{t("title")}</h1>
      </header>

      <AnimatePresence mode="wait">
        {step === "feeling" && (
          <motion.div
            key="feeling"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col gap-3"
          >
            <FeelButton
              icon={<Smile size={28} />}
              label={t("feel_good")}
              variant="success"
              onClick={onFeelGood}
            />
            <FeelButton
              icon={<HelpCircle size={28} />}
              label={t("have_complaint")}
              variant="warn"
              onClick={onComplaint}
            />
          </motion.div>
        )}

        {step === "category" && (
          <motion.div
            key="category"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-2 gap-3"
          >
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                onClick={() => onCategorySelect(c.id)}
                className="card text-left hover:bg-[var(--color-brand-soft)]/30 hover:border-[var(--color-brand)] transition flex flex-col items-start gap-3"
              >
                <div className="w-12 h-12 rounded-xl bg-[var(--color-brand-soft)] flex items-center justify-center">
                  <c.icon size={22} className="text-[var(--color-brand)]" />
                </div>
                <span className="font-heading font-bold text-sm">
                  {t(`categories.${c.key}`)}
                </span>
              </button>
            ))}
          </motion.div>
        )}

        {step === "describe" && (
          <motion.div
            key="describe"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <p className="text-[var(--color-slate-500)] mb-4">{t("describe")}</p>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder=""
              rows={5}
              className="w-full p-4 rounded-[12px] border border-[var(--color-slate-200)] bg-white text-base focus:outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand)]/20 resize-none"
              autoFocus
            />
            <div className="flex gap-2 mt-4">
              <Button onClick={onSubmit} disabled={!description.trim() || submitting} block size="lg">
                {submitting ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {t("submitting")}
                  </span>
                ) : (
                  <>
                    <Send size={18} />
                    {t("submitting") /* placeholder */}
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        )}

        {step === "advice" && advice && (
          <motion.div
            key="advice"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {advice.severity === "high" || advice.severity === "emergency" ? (
              <div className="card bg-red-50 border border-red-200">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-[var(--color-danger)] flex items-center justify-center shrink-0">
                    <AlertTriangle size={22} className="text-white" />
                  </div>
                  <div>
                    <h2 className="font-heading font-bold text-[var(--color-danger)] mb-1">
                      {t("urgent")}
                    </h2>
                    <p className="text-sm text-[var(--color-ink)] leading-relaxed mt-2">
                      {advice.advice}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="card">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 rounded-full bg-[var(--color-success)]" />
                  <h2 className="font-bold text-sm uppercase tracking-wider text-[var(--color-slate-500)]">
                    {t("advice")}
                  </h2>
                </div>
                <p className="text-base leading-relaxed">{advice.advice}</p>
              </div>
            )}
            <Button
              onClick={() => router.push(`/${locale}/today`)}
              size="lg"
              block
              className="mt-5"
              variant={advice.severity === "high" ? "danger" : "primary"}
            >
              {locale === "uz" ? "Tushundim" : locale === "ru" ? "Понятно" : "Got it"}
            </Button>
          </motion.div>
        )}

        {step === "saved" && (
          <motion.div
            key="saved"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center py-12"
          >
            <div className="w-20 h-20 rounded-full bg-[var(--color-success)] mx-auto mb-4 flex items-center justify-center">
              <Check size={40} className="text-white" strokeWidth={3} />
            </div>
            <p className="text-[var(--color-slate-500)]">{t("submitted")}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

function FeelButton({
  icon,
  label,
  variant,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  variant: "success" | "warn";
  onClick: () => void;
}) {
  const bg =
    variant === "success"
      ? "bg-gradient-to-br from-[var(--color-success)] to-emerald-500"
      : "bg-gradient-to-br from-[var(--color-accent)] to-[#fb923c]";
  return (
    <button
      onClick={onClick}
      className={`${bg} text-white p-5 rounded-[16px] flex items-center gap-4 hover:scale-[1.01] active:scale-[0.99] transition shadow-sm`}
    >
      <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur flex items-center justify-center shrink-0">
        {icon}
      </div>
      <span className="font-heading font-bold text-lg text-left">{label}</span>
    </button>
  );
}

/* ── Mock triage logic (will be replaced by API call to LLM endpoint) ── */
function mockTriage(text: string, locale: string): AdviceResult {
  const lc = text.toLowerCase();

  // Red flags (multi-language)
  const isRed =
    /sariq|жёлт|желтоват|желтый|yellow|qora siy|тёмная моч|dark urin|nafas qisil|задых|breath|yuz shish|лицо опух|swelling|ko'rishim xira|зрение хуже|vision|qon qus|кровь|blood/.test(
      lc,
    );

  if (isRed) {
    return {
      severity: "high",
      advice:
        locale === "uz"
          ? "Bu jiddiy belgi bo'lishi mumkin. Iltimos, bugun shifokoringizga murojaat qiling. Dorini to'xtating maslahatdan keyin."
          : locale === "ru"
          ? "Это может быть серьёзный симптом. Срочно обратитесь к врачу. Не прекращайте препарат до его указания."
          : "This may be a serious symptom. Please contact your doctor today. Don't stop medication until they advise.",
      escalate: true,
    };
  }

  return {
    severity: "low",
    advice:
      locale === "uz"
        ? "Ko'p hollarda bu rifampitsindan keladi va o'tib ketadi. Taom bilan iching, ko'p suv iching. Agar 2-3 kunda yaxshilanmasa — shifokorga ayting."
        : locale === "ru"
        ? "В большинстве случаев это побочный эффект, который проходит сам. Принимайте препарат с едой, пейте больше воды. Если не пройдёт за 2-3 дня — скажите врачу."
        : "Most often this is a normal side effect that passes. Take with food, drink water. If it doesn't pass in 2-3 days, tell your doctor.",
    escalate: false,
  };
}
