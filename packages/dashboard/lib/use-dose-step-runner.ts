"use client";

/**
 * useDoseStepRunner — owns the per-step verify logic:
 *  - calls inference (face-api / YOLO / Vision LLM) per step
 *  - manages stepStatus state machine: idle → checking → success/retry
 *  - on success: advances store to next step (or finalizes dose on last)
 *  - on low confidence: collects red flags for doctor review
 *  - exposes long-press progress for the swallow step
 *
 * Pure state hook — no DOM, no rendering. Returned `runStepCheck` is awaited
 * by the UI's Verify button. Camera + capture is injected via captureFrame.
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  useTBControlStore,
  type DoseFlowStep,
  type DrugCode,
  type DoseRecord,
} from "@/lib/store";
import {
  detectPills,
  verifyFace,
  verifyPillCloseup,
} from "@/lib/inference";
import { getWebApp } from "@/lib/telegram";
import type { Lang } from "@/lib/use-t";

const STEP_ORDER: DoseFlowStep[] = [
  "face_id",
  "show_box",
  "open_box",
  "show_pills",
  "pill_closeup",
  "show_glass",
  "swallow",
  "mouth_check",
  "completed",
];

export type StepStatus = "idle" | "checking" | "success" | "retry";

export interface DoseFlag {
  type: DoseRecord["flags"][number]["type"];
  note: string;
  timestamp: string;
}

export interface UseDoseStepRunnerResult {
  stepStatus: StepStatus;
  retryHint: string | null;
  longPressProgress: number;
  setLongPressProgress: React.Dispatch<React.SetStateAction<number>>;
  runStepCheck: () => Promise<void>;
  cancelDose: () => void;
}

export function useDoseStepRunner(args: {
  /** Current step from store */
  currentStep: DoseFlowStep;
  /** Drugs codes the patient is supposed to take (for inference prompts) */
  expectedDrugs: DrugCode[];
  /** Patient ID for face match against enrollment */
  patientId: string;
  /** Live <video> ref — face-api needs the element directly */
  videoElement: HTMLVideoElement | null;
  /** Async frame capture, un-mirrored, for YOLO/Vision */
  captureFrame: () => Promise<Blob | null>;
  /** Tear down the camera stream when leaving the flow */
  stopCamera: () => void;
  /** Locale for retry hints */
  lang: Lang;
}): UseDoseStepRunnerResult {
  const {
    currentStep,
    expectedDrugs,
    patientId,
    videoElement,
    captureFrame,
    stopCamera,
    lang,
  } = args;

  const router = useRouter();
  const { advanceDoseStep, completeDose, resetActiveDose } = useTBControlStore();
  // Build locale-aware paths — uz default = no prefix, others = /ru /en
  const localePath = (path: string) =>
    lang === "uz" ? path : `/${lang}${path}`;

  const [stepStatus, setStepStatus] = useState<StepStatus>("idle");
  const [retryHint, setRetryHint] = useState<string | null>(null);
  const [longPressProgress, setLongPressProgress] = useState(0);
  const [collectedFlags, setCollectedFlags] = useState<DoseFlag[]>([]);
  const [aiVerdict, setAiVerdict] = useState<{
    confidence: number | null;
    matches: boolean | null;
    pillCount: number | null;
  }>({ confidence: null, matches: null, pillCount: null });

  // Reset transient state on step change
  useEffect(() => {
    setStepStatus("idle");
    setRetryHint(null);
    setAiVerdict({ confidence: null, matches: null, pillCount: null });
  }, [currentStep]);

  const t = useCallback(
    (uz: string, ru: string, en: string) =>
      lang === "uz" ? uz : lang === "ru" ? ru : en,
    [lang],
  );

  const finalizeDose = useCallback(() => {
    completeDose(
      {
        faceMatch: aiVerdict.confidence,
        pillCount: aiVerdict.pillCount,
        pillType: aiVerdict.matches ? expectedDrugs : null,
        swallowDetected: true,
        mouthEmpty: true,
        rulesViolated: [],
      },
      collectedFlags,
    );
    stopCamera();
    router.push(localePath("/dose/complete"));
  }, [aiVerdict, collectedFlags, completeDose, expectedDrugs, router, stopCamera, localePath]);

  const runStepCheck = useCallback(async () => {
    setStepStatus("checking");
    setRetryHint(null);

    let success = false;
    let confidence: number | null = null;

    try {
      if (currentStep === "face_id") {
        if (!videoElement || videoElement.videoWidth === 0) {
          throw new Error("Video element not ready");
        }
        const r = await verifyFace(videoElement, patientId);
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
        const blob = (await captureFrame()) ?? new Blob([new Uint8Array(8)], { type: "image/jpeg" });
        const r = await detectPills(blob);
        confidence = r.detections.length > 0 ? r.detections[0].confidence : 0;
        const pillCount = r.detections.length;
        setAiVerdict((v) => ({ ...v, pillCount }));
        success = pillCount >= (currentStep === "show_pills" ? expectedDrugs.length : 1);
        if (!success) {
          setRetryHint(t(
            "Tabletkalar aniq ko'rinmayapti — yaqinlashtiring",
            "Таблетки не видны чётко — поднесите ближе",
            "Pills not clearly visible — bring closer",
          ));
        }
      } else if (currentStep === "pill_closeup") {
        const blob = (await captureFrame()) ?? new Blob([new Uint8Array(8)], { type: "image/jpeg" });
        const r = await verifyPillCloseup(blob, expectedDrugs);
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
        // Action-detection steps (open_box, show_glass, swallow, mouth_check)
        // — mocked timing for now, will be replaced with real video gestures.
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
          }
        }, 700);
      } else {
        setStepStatus("retry");
        getWebApp()?.HapticFeedback.notificationOccurred("warning");
        if (confidence !== null && confidence < 0.5) {
          setCollectedFlags((f) => [
            ...f,
            {
              type: `${currentStep}_low_confidence` as DoseFlag["type"],
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
  }, [
    currentStep,
    captureFrame,
    expectedDrugs,
    patientId,
    videoElement,
    advanceDoseStep,
    finalizeDose,
    t,
  ]);

  // Long-press confirm wired into the swallow step
  useEffect(() => {
    if (currentStep !== "swallow") return;
    if (longPressProgress >= 100) {
      runStepCheck();
      setLongPressProgress(0);
    }
  }, [longPressProgress, currentStep, runStepCheck]);

  const cancelDose = useCallback(() => {
    if (
      typeof window !== "undefined" &&
      !window.confirm(t(
        "Qabulni to'xtatasizmi? Bu qizil bayroq qoldiradi.",
        "Прервать приём? Это оставит красный флажок.",
        "Cancel dose? This leaves a red flag.",
      ))
    ) {
      return;
    }
    stopCamera();
    resetActiveDose();
    router.push(localePath("/today"));
  }, [resetActiveDose, router, stopCamera, t, localePath]);

  return {
    stepStatus,
    retryHint,
    longPressProgress,
    setLongPressProgress,
    runStepCheck,
    cancelDose,
  };
}
