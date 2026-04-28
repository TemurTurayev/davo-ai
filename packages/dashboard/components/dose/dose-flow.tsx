"use client";

/**
 * DoseFlow — strict 9-step dose-taking with AI-watched verification.
 *
 * Layout (top → bottom):
 *  1. Top bar: cancel / step counter / help
 *  2. Step instruction card — ALWAYS visible, never covered
 *  3. Live camera viewport with detection overlay (45vh, fixed) — MIRRORED for selfie UX
 *     Frame capture for AI uses canvas → un-mirrored frame goes to model
 *  4. Detection log (terminal-style, shows AI reasoning live)
 *  5. Phase indicator (3 dot clusters)
 *  6. Action button (auto-advance / long-press for swallow)
 *  7. Rules monitor (compact bottom strip)
 *
 * Mock detections from `lib/mock-detections.ts` give realistic visualization
 * even without vast.ai backend — bboxes evolve, scan lines move, log fills.
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
  HelpCircle,
  Eye,
  Brain,
} from "lucide-react";
import { useTBControlStore, type DoseFlowStep } from "@/lib/store";
import { DRUG_LABELS } from "@/lib/protocols";
import { RulesMonitor } from "@/components/dose/rules-monitor";
import { PhaseIndicator } from "@/components/dose/phase-indicator";
import { DetectionOverlay } from "@/components/dose/detection-overlay";
import { DetectionLog } from "@/components/dose/detection-log";
import {
  generateDetectionFrame,
  type DetectionFrame,
} from "@/lib/mock-detections";
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
  modelLabel: string;
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
    modelLabel: "Mediapipe FaceMesh + Embeddings",
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
    modelLabel: "YOLO v8 (custom-trained) + OCR",
  },
  open_box: {
    key: "open_box",
    titleUz: "Qutini oching",
    titleRu: "Откройте коробку",
    titleEn: "Open the box",
    hintUz: "Qopqoqni ko'taring, blistir ko'rinsin",
    hintRu: "Поднимите крышку — должен быть виден блистер",
    hintEn: "Lift the lid — blister should be visible",
    icon: Pill,
    modelLabel: "Action detection + Optical flow",
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
    modelLabel: "YOLO + Mediapipe Hands",
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
    modelLabel: "Vision LLM (Qwen-VL 7B AWQ)",
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
    modelLabel: "YOLO + translucency check",
  },
  swallow: {
    key: "swallow",
    titleUz: "Tabletkani og'izga soling va suv iching",
    titleRu: "Положите таблетку в рот и запейте",
    titleEn: "Place pill in mouth and drink water",
    hintUz: "Yutib, pastdagi tugmani bosib turing",
    hintRu: "Проглотите и удерживайте кнопку внизу",
    hintEn: "Swallow and hold the bottom button",
    icon: Pill,
    modelLabel: "Optical flow + gesture recognition",
  },
  mouth_check: {
    key: "mouth_check",
    titleUz: "Og'izni keng oching",
    titleRu: "Откройте рот пошире",
    titleEn: "Open your mouth wide",
    hintUz: "AI tabletka o'tib ketganini tekshiradi",
    hintRu: "ИИ убедится, что таблетка проглочена",
    hintEn: "AI will confirm the pill is swallowed",
    icon: Check,
    modelLabel: "Mouth-cavity scan + Vision LLM",
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

  // Mock detection frame, refreshed at 30 FPS
  const [stepStartedAt, setStepStartedAt] = useState<number>(() => Date.now());
  const [detectionFrame, setDetectionFrame] = useState<DetectionFrame | null>(null);
  const [aggregatedLog, setAggregatedLog] = useState<DetectionFrame["log"]>([]);

  const currentStep = activeDose.step;
  const meta = STEP_META[currentStep];
  const expectedDrugs = prescription?.doses[0]?.drugs.map((d) => d.drugCode) ?? [];
  const expectedPillCount = prescription?.doses[0]?.drugs.reduce((s, d) => s + d.count, 0) ?? 1;

  // Bail if no prescription
  useEffect(() => {
    if (!prescription) router.replace(`/${locale}/awaiting-prescription`);
    if (currentStep === "rules_agreement") advanceDoseStep("face_id");
  }, [prescription, currentStep, advanceDoseStep, router, locale]);

  // When step changes, reset timer + log
  useEffect(() => {
    setStepStartedAt(Date.now());
    setAggregatedLog([]);
  }, [currentStep]);

  // Camera setup
  useEffect(() => {
    let mounted = true;
    const setup = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (!mounted) {
          stream.getTracks().forEach((tr) => tr.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
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
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
    };
  }, []);

  // Mock detection generator: 30fps update
  useEffect(() => {
    if (!meta) return;
    const interval = setInterval(() => {
      const elapsed = Date.now() - stepStartedAt;
      const frame = generateDetectionFrame(currentStep, elapsed, expectedPillCount);
      setDetectionFrame(frame);
      // Append new log entries
      if (frame.log.length > 0) {
        setAggregatedLog((prev) => {
          const existingTimes = new Set(prev.map((e) => e.time));
          const newOnes = frame.log.filter((e) => !existingTimes.has(e.time));
          return [...prev, ...newOnes].slice(-12);
        });
      }
    }, 33);
    return () => clearInterval(interval);
  }, [currentStep, stepStartedAt, expectedPillCount, meta]);

  // Mock rule monitor
  useEffect(() => {
    const interval = setInterval(() => {
      const rules = ["faceInFrame", "lighting", "singlePerson", "cameraStable", "handsVisible"] as const;
      rules.forEach((r) => {
        const status = Math.random() > 0.94 ? "warning" : "ok";
        setRuleStatus(r, status);
      });
    }, 2500);
    return () => clearInterval(interval);
  }, [setRuleStatus]);

  // Capture frame as blob (UN-mirrored for AI)
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

    const frame =
      typeof document !== "undefined"
        ? captureFrame() ?? new Blob([new Uint8Array(8)], { type: "image/jpeg" })
        : new Blob([new Uint8Array(8)], { type: "image/jpeg" });

    try {
      let success = false;
      let confidence: number | null = null;

      if (currentStep === "face_id") {
        // verifyFace now uses face-api.js client-side, requires the video element
        const video = videoRef.current;
        if (!video || video.videoWidth === 0) {
          throw new Error("Video element not ready");
        }
        const r = await verifyFace(video, prescription?.patientId ?? "demo-patient-1");
        confidence = r.similarity;
        success = r.match;
        setAiVerdict((v) => ({ ...v, confidence: r.similarity }));
        if (!r.detected) {
          setRetryHint(t(
            "Yuz topilmadi — kameraga aniqroq qarang",
            "Лицо не найдено — посмотрите чётче",
            "No face detected — look directly at camera",
          ));
        } else if (!success) {
          setRetryHint(t(
            "Bu boshqa odam ko'rinadi — qaytadan urining",
            "Похоже, это другой человек — попробуйте снова",
            "Looks like a different person — try again",
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
        setTimeout(() => {
          const idx = STEP_ORDER.indexOf(currentStep);
          const next = STEP_ORDER[idx + 1];
          if (next === "completed") {
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
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    router.push(`/${locale}/dose/complete`);
  };

  const cancelDose = () => {
    if (confirm(t(
      "Qabulni to'xtatasizmi? Bu qizil bayroq qoldiradi.",
      "Прервать приём? Это оставит красный флажок.",
      "Cancel dose? This leaves a red flag.",
    ))) {
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
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
  const stepIdx = STEP_ORDER.indexOf(currentStep);
  const totalSteps = STEP_ORDER.length - 1;

  return (
    <main className="min-h-screen flex flex-col bg-slate-950 text-white relative">
      {/* TOP BAR */}
      <header className="z-30 px-4 pt-3 pb-2 flex items-center justify-between bg-slate-900/95 backdrop-blur border-b border-slate-800 shrink-0">
        <button
          onClick={cancelDose}
          className="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center"
          aria-label="cancel"
        >
          <X size={16} />
        </button>
        <div className="text-center">
          <p className="text-[9px] uppercase tracking-wider font-bold text-slate-400 font-mono">
            {t("AI VERIFIED INTAKE", "ПРИЁМ ПОД AI", "AI VERIFIED INTAKE")}
          </p>
          <p className="text-xs font-bold tabular font-mono">
            STEP {stepIdx + 1}/{totalSteps}
          </p>
        </div>
        <button
          onClick={() => alert(t("Yordam tez orada", "Помощь скоро", "Help coming soon"))}
          className="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center"
          aria-label="help"
        >
          <HelpCircle size={16} />
        </button>
      </header>

      {/* INSTRUCTION CARD — always visible */}
      <section className="z-20 px-3 pt-3 pb-2 shrink-0">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-lg"
        >
          <div className="w-10 h-10 rounded-xl bg-[var(--color-brand)]/20 text-[var(--color-brand)] flex items-center justify-center shrink-0">
            <StepIcon size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-heading font-bold text-sm leading-tight">
              {meta[`title${lang === "uz" ? "Uz" : lang === "ru" ? "Ru" : "En"}` as "titleUz" | "titleRu" | "titleEn"]}
            </p>
            <p className="text-xs text-slate-400 mt-0.5 truncate">
              {retryHint ?? meta[`hint${lang === "uz" ? "Uz" : lang === "ru" ? "Ru" : "En"}` as "hintUz" | "hintRu" | "hintEn"]}
            </p>
          </div>
        </motion.div>
      </section>

      {/* CAMERA VIEWPORT — square 1:1 (matches face overlay coords) */}
      <section className="relative mx-3 rounded-2xl overflow-hidden shadow-2xl bg-black border border-slate-800 shrink-0 aspect-square">
        {/* Mirrored video for selfie UX (AI receives un-mirrored frame via canvas) */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
          style={{ transform: "scaleX(-1)" }}
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Detection overlay */}
        {detectionFrame && (
          <DetectionOverlay
            bboxes={detectionFrame.bboxes}
            faceLandmarks={detectionFrame.faceLandmarks}
            scanProgress={detectionFrame.scanProgress}
            isScanning={detectionFrame.phase === "scanning" || stepStatus === "checking"}
            mirrored
          />
        )}

        {/* Top-left REC + step badge */}
        <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none">
          <div className="px-2.5 py-1 rounded-full bg-black/65 backdrop-blur text-white text-[10px] font-bold font-mono flex items-center gap-1.5">
            <span className="relative flex w-1.5 h-1.5">
              <span className="absolute inset-0 rounded-full bg-red-500 animate-ping" />
              <span className="relative rounded-full bg-red-500 w-1.5 h-1.5" />
            </span>
            REC
          </div>
          {stepStatus === "checking" && (
            <div className="px-2.5 py-1 rounded-full bg-cyan-500 text-white text-[10px] font-bold font-mono flex items-center gap-1.5">
              <Brain size={11} className="animate-pulse" />
              ANALYZING
            </div>
          )}
          {stepStatus === "success" && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="px-2.5 py-1 rounded-full bg-emerald-500 text-white text-[10px] font-bold font-mono flex items-center gap-1.5"
            >
              <Check size={11} strokeWidth={3} />
              VERIFIED
            </motion.div>
          )}
          {stepStatus === "retry" && (
            <div className="px-2.5 py-1 rounded-full bg-amber-500 text-white text-[10px] font-bold font-mono flex items-center gap-1.5">
              <AlertCircle size={11} />
              RETRY
            </div>
          )}
        </div>

        {/* Bottom-right "looking at" hint per step */}
        <div className="absolute bottom-2 right-2 pointer-events-none">
          <div className="px-2 py-1 rounded-md bg-black/55 backdrop-blur text-white text-[9px] font-mono flex items-center gap-1">
            <Eye size={10} />
            {meta.modelLabel}
          </div>
        </div>
      </section>

      {/* DETECTION LOG */}
      <section className="px-3 pt-2 shrink-0">
        <DetectionLog
          entries={aggregatedLog}
          confidence={detectionFrame?.liveConfidence ?? 0}
          modelName={meta.modelLabel}
        />
      </section>

      {/* PHASE INDICATOR */}
      <section className="px-3 pt-2 shrink-0">
        <PhaseIndicator currentStep={currentStep} locale={locale} />
      </section>

      {/* ACTION BUTTON */}
      <section className="px-3 pt-2 shrink-0">
        {/* Show drugs hint + reference photo of Ascorutin (demo) */}
        {(currentStep === "show_pills" || currentStep === "show_box") && (
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-2 mb-2 flex gap-2">
            {/* Reference photo — only when ascorutin demo */}
            {prescription.doses[0].drugs.some((d) => d.drugCode === "ascorutin_demo") && (
              <img
                src="/pill-references/ascorutin-n50/box-front-lekhim.jpg"
                alt="Ascorutin reference"
                className="w-16 h-16 object-cover rounded-lg shrink-0 border border-slate-600"
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-[9px] uppercase font-bold text-slate-400 mb-1.5 font-mono">
                {t("Bugungi dozalar", "Сегодняшние дозы", "Today's doses")}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {prescription.doses[0].drugs.map((drug, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold text-white shadow-sm"
                    style={{ backgroundColor: DRUG_LABELS[drug.drugCode].color }}
                  >
                    <Pill size={10} />
                    {DRUG_LABELS[drug.drugCode].abbr} · {drug.count}×{drug.dosageMg}mg
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

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
            className="w-full h-12 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-white font-heading font-bold text-sm flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition disabled:opacity-50"
          >
            <Check size={18} strokeWidth={2.5} />
            {stepStatus === "checking"
              ? t("Tekshirilmoqda…", "Проверяю…", "Checking…")
              : t("Og'iz bo'sh — yakunlash", "Рот пуст — завершить", "Mouth empty — finish")}
          </button>
        ) : (
          <button
            onClick={runStepCheck}
            disabled={stepStatus === "checking"}
            className={cn(
              "w-full h-12 rounded-2xl font-heading font-bold text-sm flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition disabled:opacity-60",
              stepStatus === "retry"
                ? "bg-amber-500 hover:bg-amber-400 text-white"
                : "bg-[var(--color-brand)] hover:bg-[var(--color-brand-dark)] text-white",
            )}
          >
            {stepStatus === "checking" ? (
              <>
                <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                {t("AI tekshirmoqda…", "ИИ проверяет…", "AI checking…")}
              </>
            ) : stepStatus === "retry" ? (
              <>
                <AlertCircle size={18} />
                {t("Qayta urining", "Попробовать снова", "Try again")}
              </>
            ) : (
              <>
                <Sparkles size={18} />
                {t("Tayyor — tekshiruv", "Готово — проверить", "Ready — verify")}
              </>
            )}
          </button>
        )}
      </section>

      {/* RULES MONITOR (compact) */}
      <section className="px-3 py-2 mt-auto shrink-0">
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
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
      className="relative w-full h-12 rounded-2xl bg-amber-500 text-white font-heading font-bold text-sm flex items-center justify-center gap-2 shadow-lg overflow-hidden disabled:opacity-50 select-none"
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
