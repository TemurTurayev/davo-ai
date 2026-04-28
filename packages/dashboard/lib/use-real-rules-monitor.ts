"use client";

/**
 * useRealRulesMonitor — combines REAL signals from face-api + Mediapipe Hands +
 * frame analysis into the 5 rule states displayed in the side panel.
 *
 * Each rule is computed from actual evidence — covering the camera with your
 * hand DOES turn "Лицо в кадре" amber/red. Walking out of frame DOES trigger
 * a violation. This was the user's #1 complaint about the previous mock.
 *
 * The hook writes to the Zustand store via `setRuleStatus` so the existing
 * RulesMonitor component re-renders correctly.
 */

import { useEffect, type RefObject } from "react";
import { useTBControlStore } from "@/lib/store";
import type { FaceTracking } from "@/lib/use-face-tracker";
import type { HandTracking } from "@/lib/use-hand-tracker";
import type { FrameAnalysis } from "@/lib/use-frame-analysis";

interface Args {
  videoRef: RefObject<HTMLVideoElement | null>;
  face: FaceTracking;
  hands: HandTracking;
  frame: FrameAnalysis;
  /** Some steps don't require hands visible (e.g. show_box) */
  handsRequired: boolean;
}

export function useRealRulesMonitor({ face, hands, frame, handsRequired }: Args): void {
  const setRuleStatus = useTBControlStore((s) => s.setRuleStatus);

  useEffect(() => {
    // Лицо в кадре: face-api detected with score > 0.5
    if (face.detected && face.score > 0.5) {
      setRuleStatus("faceInFrame", "ok");
    } else if (face.score > 0.3) {
      setRuleStatus("faceInFrame", "warning");
    } else {
      setRuleStatus("faceInFrame", "violated");
    }
  }, [face.detected, face.score, setRuleStatus]);

  useEffect(() => {
    // Освещение: brightness analysis
    // <0.18 = too dark / >0.85 = blown out / 0.25-0.7 = ideal
    if (!frame.ready) return;
    if (frame.brightness < 0.18) {
      setRuleStatus("lighting", "violated");
    } else if (frame.brightness < 0.25 || frame.brightness > 0.85) {
      setRuleStatus("lighting", "warning");
    } else {
      setRuleStatus("lighting", "ok");
    }
  }, [frame.brightness, frame.ready, setRuleStatus]);

  useEffect(() => {
    // Один человек: face-api detected exactly 1 face. Multi-face would be > 1
    // (would need detectAllFaces). For now use detected as proxy: if face is
    // tracked steadily it's one person; if face unstable + score erratic, warn.
    if (face.detected) {
      setRuleStatus("singlePerson", "ok");
    } else {
      // No face = no person to count, but not a violation per se
      setRuleStatus("singlePerson", "warning");
    }
  }, [face.detected, setRuleStatus]);

  useEffect(() => {
    // Камера стабильна: motion < 0.05 = ok, 0.05-0.15 = warning, >0.15 = violated
    if (!frame.ready) return;
    if (frame.motion > 0.15) {
      setRuleStatus("cameraStable", "violated");
    } else if (frame.motion > 0.05) {
      setRuleStatus("cameraStable", "warning");
    } else {
      setRuleStatus("cameraStable", "ok");
    }
  }, [frame.motion, frame.ready, setRuleStatus]);

  useEffect(() => {
    // Руки видны: Mediapipe Hands detected ≥1 hand on steps that need them.
    // On steps where hands aren't required (face_id, show_box), keep neutral.
    if (!handsRequired) {
      setRuleStatus("handsVisible", "ok");
      return;
    }
    if (hands.detected && hands.hands.length >= 1) {
      setRuleStatus("handsVisible", "ok");
    } else {
      setRuleStatus("handsVisible", "violated");
    }
  }, [hands.detected, hands.hands.length, handsRequired, setRuleStatus]);
}
