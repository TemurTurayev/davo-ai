"use client";

/**
 * useMockDetections — drives the per-step mock visualization (bboxes,
 * face-mesh fade-in, scan line, AI-reasoning log) at 10 FPS.
 *
 * Pauses while `paused` is true so the main thread is free for real
 * face-api / Vision LLM inference during a Verify click.
 *
 * Resets the timer + log whenever `step` changes.
 */

import { useEffect, useState } from "react";
import {
  generateDetectionFrame,
  type DetectionFrame,
} from "@/lib/mock-detections";
import type { DoseFlowStep } from "@/lib/store";

export interface UseMockDetectionsResult {
  detectionFrame: DetectionFrame | null;
  aggregatedLog: DetectionFrame["log"];
}

export function useMockDetections(
  step: DoseFlowStep,
  expectedPillCount: number,
  paused: boolean,
): UseMockDetectionsResult {
  const [stepStartedAt, setStepStartedAt] = useState<number>(() => Date.now());
  const [detectionFrame, setDetectionFrame] = useState<DetectionFrame | null>(null);
  const [aggregatedLog, setAggregatedLog] = useState<DetectionFrame["log"]>([]);

  // Reset on step change
  useEffect(() => {
    setStepStartedAt(Date.now());
    setAggregatedLog([]);
  }, [step]);

  useEffect(() => {
    if (paused) return;
    const interval = setInterval(() => {
      const elapsed = Date.now() - stepStartedAt;
      const frame = generateDetectionFrame(step, elapsed, expectedPillCount);
      setDetectionFrame(frame);
      if (frame.log.length > 0) {
        setAggregatedLog((prev) => {
          const existingTimes = new Set(prev.map((e) => e.time));
          const newOnes = frame.log.filter((e) => !existingTimes.has(e.time));
          if (newOnes.length === 0) return prev;
          return [...prev, ...newOnes].slice(-12);
        });
      }
    }, 100); // 10 FPS — smooth without thrashing React
    return () => clearInterval(interval);
  }, [step, stepStartedAt, expectedPillCount, paused]);

  return { detectionFrame, aggregatedLog };
}
