"use client";

/**
 * DoseFlow — strict 9-step dose-taking with AI-watched verification.
 *
 * This file is the orchestrator/render layer. All logic lives in hooks:
 *  - useCamera           → getUserMedia + canvas capture
 *  - useFaceTracker      → real face-api.js bbox + landmarks (~7 FPS)
 *  - useMockDetections   → bbox/log visualization (10 FPS, paused during checking)
 *  - useDoseStepRunner   → state machine: idle → checking → success/retry
 *
 * Layout: top bar + instruction card · left col (camera+phase+button) ·
 * right col (detection log + drugs hint + rules monitor).
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Check,
  Pill,
  Sparkles,
  X,
  AlertCircle,
  HelpCircle,
  Eye,
  Brain,
} from "lucide-react";
import { useTBControlStore } from "@/lib/store";
import { DRUG_LABELS } from "@/lib/protocols";
import { RulesMonitor } from "@/components/dose/rules-monitor";
import { PhaseIndicator } from "@/components/dose/phase-indicator";
import { DetectionOverlay } from "@/components/dose/detection-overlay";
import { DetectionLog } from "@/components/dose/detection-log";
import { LongPressButton } from "@/components/dose/long-press-button";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/use-t";
import { useCamera } from "@/lib/use-camera";
import { useFaceTracker } from "@/lib/use-face-tracker";
import { useMockDetections } from "@/lib/use-mock-detections";
import { useDoseStepRunner } from "@/lib/use-dose-step-runner";
import { STEP_META, DOSE_STEP_ORDER } from "@/lib/dose-step-meta";

export function DoseFlow({ locale }: { locale: string }) {
  const router = useRouter();
  const { t, lang } = useT();
  const { prescription, activeDose, advanceDoseStep, setRuleStatus } = useTBControlStore();

  const currentStep = activeDose.step;
  const meta = STEP_META[currentStep];
  const expectedDrugs = prescription?.doses[0]?.drugs.map((d) => d.drugCode) ?? [];
  const expectedPillCount = prescription?.doses[0]?.drugs.reduce((s, d) => s + d.count, 0) ?? 1;

  // Hooks — order matters, must be called unconditionally before early returns
  const camera = useCamera(true);
  const realFaceTracking = useFaceTracker(camera.videoRef, currentStep === "face_id");
  const stopCamera = () => camera.videoRef.current?.srcObject &&
    (camera.videoRef.current.srcObject as MediaStream).getTracks().forEach((t) => t.stop());

  const runner = useDoseStepRunner({
    currentStep,
    expectedDrugs,
    patientId: prescription?.patientId ?? "demo-patient-1",
    videoElement: camera.videoRef.current,
    captureFrame: camera.captureFrame,
    stopCamera,
    lang,
  });

  // Mock visualization (paused during AI inference so face-api runs free)
  const { detectionFrame, aggregatedLog } = useMockDetections(
    currentStep,
    expectedPillCount,
    runner.stepStatus === "checking" || runner.stepStatus === "success",
  );

  // Mock rule monitor — gentle 2.5s jitter
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

  // Bail to awaiting-prescription if we landed here without a prescription;
  // skip the rules_agreement step (legacy from when it was inline)
  useEffect(() => {
    if (!prescription) router.replace(`/${locale}/awaiting-prescription`);
    if (currentStep === "rules_agreement") advanceDoseStep("face_id");
  }, [prescription, currentStep, advanceDoseStep, router, locale]);

  if (!meta || !prescription) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-400">
        <p>Loading…</p>
      </main>
    );
  }

  const StepIcon = meta.icon;
  const stepIdx = DOSE_STEP_ORDER.indexOf(currentStep);
  const totalSteps = DOSE_STEP_ORDER.length - 1;
  const titleKey = `title${lang === "uz" ? "Uz" : lang === "ru" ? "Ru" : "En"}` as const;
  const hintKey = `hint${lang === "uz" ? "Uz" : lang === "ru" ? "Ru" : "En"}` as const;

  return (
    <main className="min-h-screen flex flex-col bg-slate-950 text-white relative">
      {/* TOP BAR */}
      <header className="z-30 px-6 py-3 flex items-center justify-between bg-slate-900/95 backdrop-blur border-b border-slate-800 shrink-0">
        <button
          onClick={runner.cancelDose}
          className="w-10 h-10 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center"
          aria-label="cancel"
        >
          <X size={18} />
        </button>
        <div className="text-center">
          <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 font-mono">
            {t("AI VERIFIED INTAKE", "ПРИЁМ ПОД AI", "AI VERIFIED INTAKE")}
          </p>
          <p className="text-sm font-bold tabular font-mono">
            STEP {stepIdx + 1} / {totalSteps}
          </p>
        </div>
        <button
          onClick={() => alert(t("Yordam tez orada", "Помощь скоро", "Help coming soon"))}
          className="w-10 h-10 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center"
          aria-label="help"
        >
          <HelpCircle size={18} />
        </button>
      </header>

      <div className="flex-1 max-w-6xl w-full mx-auto px-4 py-4 flex flex-col gap-3">
        {/* INSTRUCTION CARD */}
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl px-5 py-4 flex items-center gap-4 shadow-lg"
        >
          <div className="w-12 h-12 rounded-2xl bg-[var(--color-brand)]/20 text-[var(--color-brand)] flex items-center justify-center shrink-0">
            <StepIcon size={24} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-heading font-bold text-base leading-tight">
              {meta[titleKey]}
            </p>
            <p className="text-sm text-slate-400 mt-0.5">
              {runner.retryHint ?? meta[hintKey]}
            </p>
          </div>
          <div className="hidden md:block px-3 py-1.5 rounded-md bg-slate-900 text-slate-400 text-[10px] font-mono border border-slate-700 shrink-0">
            {meta.modelLabel}
          </div>
        </motion.div>

        {/* GRID: camera (left) + side panel (right) */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-3 flex-1 min-h-0">
          {/* LEFT: Camera + phase + action button */}
          <div className="flex flex-col gap-3 min-h-0">
            <section className="relative rounded-2xl overflow-hidden shadow-2xl bg-black border border-slate-800 aspect-square mx-auto w-full max-w-[640px]">
              <video
                ref={camera.videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
                style={{ transform: "scaleX(-1)" }}
              />
              <canvas ref={camera.canvasRef} className="hidden" />

              {detectionFrame && (
                <DetectionOverlay
                  bboxes={detectionFrame.bboxes}
                  faceLandmarks={detectionFrame.faceLandmarks}
                  scanProgress={detectionFrame.scanProgress}
                  isScanning={detectionFrame.phase === "scanning" || runner.stepStatus === "checking"}
                  mirrored
                  realTracking={realFaceTracking}
                  step={currentStep}
                />
              )}

              {/* Status badges */}
              <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
                <div className="px-3 py-1.5 rounded-full bg-black/70 backdrop-blur text-white text-xs font-bold font-mono flex items-center gap-1.5">
                  <span className="relative flex w-2 h-2">
                    <span className="absolute inset-0 rounded-full bg-red-500 animate-ping" />
                    <span className="relative rounded-full bg-red-500 w-2 h-2" />
                  </span>
                  REC
                </div>
                {runner.stepStatus === "checking" && (
                  <div className="px-3 py-1.5 rounded-full bg-cyan-500 text-white text-xs font-bold font-mono flex items-center gap-1.5">
                    <Brain size={13} className="animate-pulse" />
                    ANALYZING
                  </div>
                )}
                {runner.stepStatus === "success" && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="px-3 py-1.5 rounded-full bg-emerald-500 text-white text-xs font-bold font-mono flex items-center gap-1.5"
                  >
                    <Check size={13} strokeWidth={3} />
                    VERIFIED
                  </motion.div>
                )}
                {runner.stepStatus === "retry" && (
                  <div className="px-3 py-1.5 rounded-full bg-amber-500 text-white text-xs font-bold font-mono flex items-center gap-1.5">
                    <AlertCircle size={13} />
                    RETRY
                  </div>
                )}
              </div>

              <div className="absolute bottom-3 right-3 pointer-events-none">
                <div className="px-2.5 py-1 rounded-md bg-black/60 backdrop-blur text-white text-[10px] font-mono flex items-center gap-1.5">
                  <Eye size={11} />
                  {meta.modelLabel}
                </div>
              </div>
            </section>

            <PhaseIndicator currentStep={currentStep} locale={locale} />

            <ActionButton runner={runner} t={t} currentStep={currentStep} />
          </div>

          {/* RIGHT: detection log + drugs + rules */}
          <aside className="flex flex-col gap-3 min-h-0">
            <DetectionLog
              entries={aggregatedLog}
              confidence={detectionFrame?.liveConfidence ?? 0}
              modelName={meta.modelLabel}
            />

            {(currentStep === "show_pills" || currentStep === "show_box") && (
              <div className="bg-slate-900 border border-slate-700 rounded-2xl p-3">
                <p className="text-[10px] uppercase font-bold text-slate-400 mb-2 font-mono">
                  {t("Bugungi dozalar", "Сегодняшние дозы", "Today's doses")}
                </p>
                <div className="flex gap-3">
                  {prescription.doses[0].drugs.some((d) => d.drugCode === "ascorutin_demo") && (
                    <img
                      src="/pill-references/ascorutin-n50/box-front-lekhim.jpg"
                      alt="Ascorutin reference"
                      className="w-20 h-20 object-cover rounded-lg shrink-0 border border-slate-600"
                    />
                  )}
                  <div className="flex-1 min-w-0 flex flex-wrap gap-1.5 content-start">
                    {prescription.doses[0].drugs.map((drug, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold text-white shadow-sm h-fit"
                        style={{ backgroundColor: DRUG_LABELS[drug.drugCode].color }}
                      >
                        <Pill size={11} />
                        {DRUG_LABELS[drug.drugCode].abbr} · {drug.count}×{drug.dosageMg}mg
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-3">
              <p className="text-[10px] uppercase font-bold text-slate-400 mb-2 font-mono">
                {t("Qoidalar holati", "Соблюдение правил", "Rules status")}
              </p>
              <RulesMonitor locale={locale} layout="side" />
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Action button — centralized step → button mapping
// ────────────────────────────────────────────────────────────────────────────

function ActionButton({
  runner,
  t,
  currentStep,
}: {
  runner: ReturnType<typeof useDoseStepRunner>;
  t: (uz: string, ru: string, en: string) => string;
  currentStep: string;
}) {
  if (currentStep === "swallow") {
    return (
      <LongPressButton
        label={t("Yutdim — bosib turing", "Я проглотил — удерживайте", "I've swallowed — hold")}
        onComplete={() => runner.setLongPressProgress(100)}
        progress={runner.longPressProgress}
        setProgress={runner.setLongPressProgress}
        disabled={runner.stepStatus === "checking"}
      />
    );
  }
  if (currentStep === "mouth_check") {
    return (
      <button
        onClick={runner.runStepCheck}
        disabled={runner.stepStatus === "checking"}
        className="w-full h-14 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-white font-heading font-bold text-base flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition disabled:opacity-50"
      >
        <Check size={20} strokeWidth={2.5} />
        {runner.stepStatus === "checking"
          ? t("Tekshirilmoqda…", "Проверяю…", "Checking…")
          : t("Og'iz bo'sh — yakunlash", "Рот пуст — завершить", "Mouth empty — finish")}
      </button>
    );
  }
  return (
    <button
      onClick={runner.runStepCheck}
      disabled={runner.stepStatus === "checking"}
      className={cn(
        "w-full h-14 rounded-2xl font-heading font-bold text-base flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition disabled:opacity-60",
        runner.stepStatus === "retry"
          ? "bg-amber-500 hover:bg-amber-400 text-white"
          : "bg-[var(--color-brand)] hover:bg-[var(--color-brand-dark)] text-white",
      )}
    >
      {runner.stepStatus === "checking" ? (
        <>
          <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
          {t("AI tekshirmoqda…", "ИИ проверяет…", "AI checking…")}
        </>
      ) : runner.stepStatus === "retry" ? (
        <>
          <AlertCircle size={20} />
          {t("Qayta urining", "Попробовать снова", "Try again")}
        </>
      ) : (
        <>
          <Sparkles size={20} />
          {t("Tayyor — tekshiruv", "Готово — проверить", "Ready — verify")}
        </>
      )}
    </button>
  );
}
