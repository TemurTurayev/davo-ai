"use client";

/**
 * DoseFlow — the strict 9-step state machine with AI-watched dose-taking.
 *
 * Architecture (per research synthesis):
 *  - 3 phases: Identify (face+box) → Verify (open+pills+closeup+glass) → Ingest (swallow+mouth)
 *  - AI auto-advances steps 1-7; step 8 (mouth check) requires AI + long-press confirm
 *  - Side-panel rules monitor (always-on; amber for violations, never red until session-end)
 *  - Failures: re-explain (different wording), retry on same step, never restart from step 1
 *  - Red flag: completion proceeds even if AI uncertain → doctor reviews
 *  - Camera always on; mock detection runs each step; production swaps in vast.ai endpoints
 *
 * UX language per research: "Coach the action, not the person."
 *   "Box not visible yet" beats "You failed."
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera as CameraIcon,
  Check,
  Pill,
  Sparkles,
  X,
  AlertCircle,
  Lock,
  HelpCircle,
} from "lucide-react";
import { useTBControlStore, type DoseFlowStep } from "@/lib/store";
import { DRUG_LABELS } from "@/lib/protocols";
import { RulesMonitor } from "@/components/dose/rules-monitor";
import { PhaseIndicator } from "@/components/dose/phase-indicator";
import { cn } from "@/lib/utils";
import { detectPills, verifyFace, verifyPillCloseup } from "@/lib/inference";
import { getWebApp } from "@/lib/telegram";

const STEP_ORDER: DoseFlowStep[] = [
  "face_id", "show_box",
  "open_box", "show_pills", "pill_closeup", "show_glass",
  "swallow", "mouth_check", "completed",
];

interface StepUI {
  key: DoseFlowStep;
  titleUz: string;
  titleRu: string;
  titleEn: string;
  hintUz: string;
  hintRu: string;
  hintEn: string;
  icon: typeof Pill;
}

const STEP_META: Record<DoseFlowStep, StepUI | null> = {
  rules_agreement: null,
  completed: null,
  face_id: {
    key: "face_id",
    titleUz: "Yuzni kameraga ko'rsating",
    titleRu: "Покажите лицо в камеру",
    titleEn: "Show your face to the camera",
    hintUz: "Asta-sekin chapga, keyin o'ngga buring",
    hintRu: "Медленно поверните голову влево, затем вправо",
    hintEn: "Slowly turn your head left, then right",
    icon: CameraIcon,
  },
  show_box: {
    key: "show_box",
    titleUz: "Tabletka qutisini ko'rsating",
    titleRu: "Покажите коробку с таблетками",
    titleEn: "Show the pill box",
    hintUz: "Qutining yorlig'i kameraga qaragan bo'lsin",
    hintRu: "Этикеткой к камере",
    hintEn: "Hold so the label faces the camera",
    icon: Pill,
  },
  open_box: {
    key: "open_box",
    titleUz: "Qutini oching",
    titleRu: "Откройте коробку",
    titleEn: "Open the box",
    hintUz: "Qopqoqni ko'taring",
    hintRu: "Поднимите крышку",
    hintEn: "Lift the lid",
    icon: Pill,
  },
  show_pills: {
    key: "show_pills",
    titleUz: "Tabletkalarni kaftga oling",
    titleRu: "Положите таблетки на ладонь",
    titleEn: "Place pills on your palm",
    hintUz: "Hammasi ko'rinishi kerak",
    hintRu: "Все таблетки должны быть видны",
    hintEn: "All pills must be visible",
    icon: Pill,
  },
  pill_closeup: {
    key: "pill_closeup",
    titleUz: "Tabletkani yaqinroq ko'rsating",
    titleRu: "Поднесите таблетку ближе",
    titleEn: "Hold the pill closer",
    hintUz: "AI dorining turini tekshiradi",
    hintRu: "ИИ проверит тип препарата",
    hintEn: "AI will verify the drug type",
    icon: Sparkles,
  },
  show_glass: {
    key: "show_glass",
    titleUz: "Suvli stakanni ko'rsating",
    titleRu: "Покажите стакан с водой",
    titleEn: "Show the glass of water",
    hintUz: "Stakan shaffof bo'lishi kerak",
    hintRu: "Стакан должен быть прозрачным",
    hintEn: "Glass must be transparent",
    icon: Pill,
  },
  swallow: {
    key: "swallow",
    titleUz: "Tabletkani og'izga soling va suv iching",
    titleRu: "Положите таблетку в рот и запейте",
    titleEn: "Place pill in mouth and drink water",
    hintUz: "Asta-sekin yutib yuboring",
    hintRu: "Глотайте медленно",
    hintEn: "Swallow slowly",
    icon: Pill,
  },
  mouth_check: {
    key: "mouth_check",
    titleUz: "Og'izni keng oching va ko'rsating",
    titleRu: "Откройте рот и покажите",
    titleEn: "Open your mouth wide and show",
    hintUz: "AI tabletka o'tib ketganini tekshiradi",
    hintRu: "ИИ убедится, что таблетка проглочена",
    hintEn: "AI will confirm the pill went down",
    icon: Check,
  },
};

export function DoseFlow({ locale }: { locale: string }) {
  const router = useRouter();
  const {
    prescription,
    activeDose,
    advanceDoseStep,
    setRuleStatus,
    completeDose,
    addWarning,
    resetActiveDose,
  } = useTBControlStore();

  const lang = (locale === "uz" || locale === "ru" ? locale : "en") as "uz" | "ru" | "en";
  const t = (uz: string, ru: string, en: string) =>
    lang === "uz" ? uz : lang === "ru" ? ru : en;

  // Camera + canvas refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Step state
  const [stepStatus, setStepStatus] = useState<"idle" | "checking" | "success" | "retry">("idle");
  const [retryHint, setRetryHint] = useState<string | null>(null);
  const [longPressProgress, setLongPressProgress] = useState(0);
  const [collectedFlags, setCollectedFlags] = useState<{ type: string; note: string; timestamp: string }[]>([]);
  const [aiVerdict, setAiVerdict] = useState<{ confidence: number | null; matches: boolean | null; pillCount: number | null }>({
    confidence: null,
    matches: null,
    pillCount: null,
  });

  const currentStep = activeDose.step;
  const meta = STEP_META[currentStep];
  const expectedDrugs = prescription?.doses[0]?.drugs.map((d) => d.drugCode) ?? [];

  // Bail if no prescription
  useEffect(() => {
    if (!prescription) router.replace(`/${locale}/awaiting-prescription`);
    if (currentStep === "rules_agreement") advanceDoseStep("face_id");
  }, [prescription, currentStep, advanceDoseStep, router, locale]);

  // Camera setup
  useEffect(() => {
    let mounted = true;
    const setup = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: 1280, height: 720 },
          audio: false,
        });
        if (!mounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Camera unavailable:", err);
        setCollectedFlags((f) => [
          ...f,
          {
            type: "connection_lost",
            note: "Camera permission denied or unavailable",
            timestamp: new Date().toISOString(),
          },
        ]);
      }
    };
    setup();
    return () => {
      mounted = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Mock rule monitor — alternates statuses for demo
  useEffect(() => {
    const interval = setInterval(() => {
      // Random small jitter — most of the time green, occasional warning
      const rules = ["faceInFrame", "lighting", "singlePerson", "cameraStable", "handsVisible"] as const;
      rules.forEach((r) => {
        const roll = Math.random();
        const status = roll > 0.92 ? "warning" : "ok";
        setRuleStatus(r, status);
      });
    }, 2500);
    return () => clearInterval(interval);
  }, [setRuleStatus]);

  // Capture frame as blob
  const captureFrame = useCallback((): Blob | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return null;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0);
    let blob: Blob | null = null;
    canvas.toBlob((b) => (blob = b), "image/jpeg", 0.85);
    return blob;
  }, []);

  // Run AI check on current step
  const runStepCheck = useCallback(async () => {
    if (!meta) return;
    setStepStatus("checking");
    setRetryHint(null);

    // Simulate frame capture (mock or real)
    const frame =
      typeof document !== "undefined"
        ? captureFrame() ?? new Blob([new Uint8Array(8)], { type: "image/jpeg" })
        : new Blob([new Uint8Array(8)], { type: "image/jpeg" });

    try {
      let success = false;
      let confidence: number | null = null;
      const flagOnFail: { type: string; note: string } | null = null;

      if (currentStep === "face_id") {
        const r = await verifyFace(frame, prescription?.patientId ?? "demo");
        confidence = r.similarity;
        success = r.match;
        if (!success) {
          setRetryHint(t(
            "Yorug'roq joyga o'ting va kameraga qarang",
            "Перейдите в светлое место и посмотрите в камеру",
            "Move to better light and look at camera",
          ));
        }
      } else if (currentStep === "show_box" || currentStep === "show_pills") {
        const r = await detectPills(frame);
        confidence = r.detections.length > 0 ? r.detections[0].confidence : 0;
        const pillCount = r.detections.length;
        setAiVerdict((v) => ({ ...v, pillCount }));
        success = r.detections.length >= (currentStep === "show_pills" ? expectedDrugs.length : 1);
        if (!success) {
          setRetryHint(t(
            "Tabletkalar aniq ko'rinmayapti — yaqinlashtiring",
            "Таблетки не видны чётко — поднесите ближе",
            "Pills not clearly visible — bring closer",
          ));
        }
      } else if (currentStep === "pill_closeup") {
        const r = await verifyPillCloseup(frame, expectedDrugs);
        confidence = r.confidence;
        success = r.matches;
        setAiVerdict((v) => ({ ...v, matches: r.matches, confidence: r.confidence }));
        if (!success) {
          setRetryHint(t(
            "Tabletka aniq ko'rinmayapti — yorug'lik va fokus",
            "Таблетка не видна чётко — свет и фокус",
            "Pill not clearly visible — check light and focus",
          ));
        }
      } else {
        // open_box, show_glass, swallow, mouth_check — mock action detection
        await new Promise((r) => setTimeout(r, 1400 + Math.random() * 800));
        success = Math.random() > 0.15;
        confidence = 0.82 + Math.random() * 0.13;
        if (!success) {
          setRetryHint(t(
            "Harakat aniq emas — qaytadan urining",
            "Действие не распознано — попробуйте ещё раз",
            "Action unclear — try again",
          ));
        }
      }

      if (success) {
        setStepStatus("success");
        getWebApp()?.HapticFeedback.notificationOccurred("success");
        // Wait briefly for "success" UI, then advance
        setTimeout(() => {
          const idx = STEP_ORDER.indexOf(currentStep);
          const next = STEP_ORDER[idx + 1];
          if (next === "completed") {
            // Final step done
            finalizeDose();
          } else {
            advanceDoseStep(next);
            setStepStatus("idle");
            setAiVerdict({ confidence: null, matches: null, pillCount: null });
          }
        }, 700);
      } else {
        setStepStatus("retry");
        getWebApp()?.HapticFeedback.notificationOccurred("warning");
        if (confidence !== null && confidence < 0.5) {
          // Low-confidence fail = potential red flag
          setCollectedFlags((f) => [
            ...f,
            {
              type: `${currentStep}_low_confidence`,
              note: `AI confidence ${(confidence! * 100).toFixed(0)}% on ${currentStep}`,
              timestamp: new Date().toISOString(),
            },
          ]);
        }
      }
    } catch (err) {
      console.error("Step check failed:", err);
      setStepStatus("retry");
      setRetryHint(t(
        "Aloqa xatosi — qayta urining",
        "Ошибка соединения — попробуйте снова",
        "Connection issue — try again",
      ));
      setCollectedFlags((f) => [
        ...f,
        {
          type: "connection_lost",
          note: `Inference failed at ${currentStep}: ${(err as Error).message}`,
          timestamp: new Date().toISOString(),
        },
      ]);
    }
  }, [currentStep, captureFrame, expectedDrugs, prescription, advanceDoseStep, t, meta]);

  // Long-press confirm for swallow step
  useEffect(() => {
    if (currentStep !== "swallow") return;
    if (longPressProgress >= 100) {
      runStepCheck();
      setLongPressProgress(0);
    }
  }, [longPressProgress, currentStep, runStepCheck]);

  const finalizeDose = () => {
    completeDose(
      {
        faceMatch: aiVerdict.confidence,
        pillCount: aiVerdict.pillCount,
        pillType: aiVerdict.matches ? expectedDrugs : null,
        swallowDetected: true,
        mouthEmpty: true,
        rulesViolated: [],
      },
      collectedFlags.map((f) => ({
        type: f.type as "face_mismatch" | "pill_mismatch" | "swallow_uncertain" | "mouth_unclear" | "connection_lost" | "rule_violation",
        note: f.note,
        timestamp: f.timestamp,
      })),
    );
    streamRef.current?.getTracks().forEach((t) => t.stop());
    router.push(`/${locale}/dose/complete`);
  };

  const cancelDose = () => {
    if (confirm(t(
      "Qabulni to'xtatasizmi? Bu qizil bayroq qoldiradi.",
      "Прервать приём? Это оставит красный флажок.",
      "Cancel dose? This leaves a red flag.",
    ))) {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      resetActiveDose();
      router.push(`/${locale}/today`);
    }
  };

  if (!meta || !prescription) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-[var(--color-slate-500)]">Loading...</p>
      </main>
    );
  }

  const StepIcon = meta.icon;
  const totalDrugs = prescription.doses[0]?.drugs.reduce((s, d) => s + d.count, 0) ?? 0;

  return (
    <main className="bg-aurora min-h-screen relative flex flex-col">
      {/* Top bar */}
      <header className="relative z-20 px-4 pt-4 pb-2 flex items-center justify-between bg-white/85 backdrop-blur shadow-sm">
        <button
          onClick={cancelDose}
          className="w-9 h-9 rounded-full bg-[var(--color-mist)] flex items-center justify-center text-[var(--color-slate-600)]"
          aria-label="cancel"
        >
          <X size={18} />
        </button>
        <div className="text-center">
          <p className="text-[10px] uppercase tracking-wider font-bold text-[var(--color-slate-400)]">
            {t("Dorini qabul qilish", "Приём дозы", "Dose intake")}
          </p>
          <p className="text-xs font-semibold tabular flex items-center gap-1.5 justify-center">
            <Lock size={11} className="text-[var(--color-brand)]" />
            {totalDrugs} {t("dori", "табл.", "pills")}
          </p>
        </div>
        <button
          onClick={() => alert(t("Yordam tez orada", "Помощь скоро", "Help coming soon"))}
          className="w-9 h-9 rounded-full bg-[var(--color-mist)] flex items-center justify-center text-[var(--color-slate-600)]"
          aria-label="help"
        >
          <HelpCircle size={18} />
        </button>
      </header>

      {/* Camera viewport (top half) */}
      <section className="relative flex-1 mx-3 mt-3 mb-2 rounded-3xl overflow-hidden shadow-xl bg-slate-900 min-h-[260px]">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Camera overlay: status pill */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
          <div className="px-3 py-1.5 rounded-full bg-black/40 backdrop-blur text-white text-xs font-semibold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            REC
          </div>
          {stepStatus === "checking" && (
            <div className="px-3 py-1.5 rounded-full bg-[var(--color-brand)] text-white text-xs font-semibold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              AI {t("tekshirmoqda", "проверяет", "checking")}…
            </div>
          )}
          {stepStatus === "success" && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="px-3 py-1.5 rounded-full bg-[var(--color-success)] text-white text-xs font-bold flex items-center gap-1.5"
            >
              <Check size={14} strokeWidth={3} />
              {t("Tasdiqlandi", "Подтверждено", "Confirmed")}
            </motion.div>
          )}
        </div>

        {/* Center step instruction overlay */}
        <div className="absolute inset-x-3 bottom-3">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/92 backdrop-blur rounded-2xl px-4 py-3 shadow-md flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-xl bg-[var(--color-brand-soft)] text-[var(--color-brand)] flex items-center justify-center shrink-0">
              <StepIcon size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-heading font-bold text-sm leading-tight">
                {meta[`title${lang === "uz" ? "Uz" : lang === "ru" ? "Ru" : "En"}` as "titleUz" | "titleRu" | "titleEn"]}
              </p>
              <p className="text-xs text-[var(--color-slate-500)] mt-0.5 truncate">
                {retryHint ?? meta[`hint${lang === "uz" ? "Uz" : lang === "ru" ? "Ru" : "En"}` as "hintUz" | "hintRu" | "hintEn"]}
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Action area (bottom) */}
      <section className="relative z-10 mx-3 mb-2">
        {/* Show pills hint with drug chips */}
        {(currentStep === "show_pills" || currentStep === "show_box") && (
          <div className="bg-white rounded-2xl p-3 mb-2 shadow-sm">
            <p className="text-[10px] uppercase font-bold text-[var(--color-slate-500)] mb-1.5">
              {t("Bugungi dorilar", "Сегодняшние дозы", "Today's drugs")}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {prescription.doses[0].drugs.map((drug, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-bold text-white shadow-sm"
                  style={{ backgroundColor: DRUG_LABELS[drug.drugCode].color }}
                >
                  <Pill size={10} />
                  {DRUG_LABELS[drug.drugCode].abbr} · {drug.count}×{drug.dosageMg}mg
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Action button */}
        {currentStep === "swallow" ? (
          <LongPressButton
            label={t("Yutdim — bosib turing", "Я проглотил — удерживайте", "I've swallowed — hold")}
            onComplete={() => setLongPressProgress(100)}
            progress={longPressProgress}
            setProgress={setLongPressProgress}
            disabled={stepStatus === "checking"}
          />
        ) : currentStep === "mouth_check" ? (
          <button
            onClick={runStepCheck}
            disabled={stepStatus === "checking"}
            className="w-full h-14 rounded-2xl bg-[var(--color-brand)] text-white font-heading font-bold text-base flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition disabled:opacity-50"
          >
            <Check size={20} strokeWidth={2.5} />
            {stepStatus === "checking"
              ? t("Tekshirilmoqda…", "Проверяю…", "Checking…")
              : t("Og'iz bo'sh — yakunlash", "Рот пуст — завершить", "Mouth empty — finish")}
          </button>
        ) : (
          <button
            onClick={runStepCheck}
            disabled={stepStatus === "checking"}
            className={cn(
              "w-full h-14 rounded-2xl font-heading font-bold text-base flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition disabled:opacity-60",
              stepStatus === "retry"
                ? "bg-amber-500 text-white"
                : "bg-[var(--color-brand)] text-white",
            )}
          >
            {stepStatus === "checking" ? (
              <>
                <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                {t("AI tekshirmoqda…", "ИИ проверяет…", "AI checking…")}
              </>
            ) : stepStatus === "retry" ? (
              <>
                <AlertCircle size={20} />
                {t("Qayta urining", "Попробовать снова", "Try again")}
              </>
            ) : (
              <>
                <Sparkles size={20} />
                {t("Tayyor", "Готово", "Ready")}
              </>
            )}
          </button>
        )}
      </section>

      {/* Phase indicator */}
      <section className="px-3 pb-2">
        <PhaseIndicator currentStep={currentStep} locale={locale} />
      </section>

      {/* Rules monitor (bottom strip on mobile) */}
      <section className="px-3 pb-3">
        <RulesMonitor locale={locale} layout="bottom" />
      </section>
    </main>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Long-press button (for swallow confirmation)
// ────────────────────────────────────────────────────────────────────────────

function LongPressButton({
  label,
  onComplete,
  progress,
  setProgress,
  disabled,
}: {
  label: string;
  onComplete: () => void;
  progress: number;
  setProgress: (n: number) => void;
  disabled?: boolean;
}) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const start = () => {
    if (disabled) return;
    intervalRef.current = setInterval(() => {
      setProgress(Math.min(100, progress + 4));
    }, 50);
  };
  const stop = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (progress < 100) setProgress(0);
  };

  useEffect(() => {
    if (progress >= 100) {
      onComplete();
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
  }, [progress, onComplete]);

  return (
    <button
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      disabled={disabled}
      className="relative w-full h-14 rounded-2xl bg-[var(--color-accent)] text-white font-heading font-bold text-base flex items-center justify-center gap-2 shadow-lg overflow-hidden disabled:opacity-50"
    >
      <div
        className="absolute inset-0 bg-white/20 transition-all"
        style={{ width: `${progress}%` }}
      />
      <span className="relative z-10 flex items-center gap-2">
        <Pill size={20} />
        {label}
      </span>
    </button>
  );
}
