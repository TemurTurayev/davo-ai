/**
 * Mock detection generator — produces realistic-looking AI detections
 * that change over time per dose-flow step.
 *
 * Used for demo when vast.ai backend is unavailable. When real backend is
 * connected, swap this for actual responses from `lib/inference.ts`.
 *
 * Each step has its own pattern of bboxes/landmarks/scan-progress that
 * evolves over time, simulating "AI is looking → AI found it → AI confirmed".
 */

import type { DoseFlowStep } from "@/lib/store";

export interface BBox {
  id: string;
  /** [x1, y1, x2, y2] normalized 0-1 (relative to video) */
  bbox: [number, number, number, number];
  label: string;
  confidence: number;
  color: string;
  /** "detecting" | "tracked" | "verified" — affects visual style */
  state: "detecting" | "tracked" | "verified";
}

export interface FaceLandmark {
  x: number;       // normalized 0-1
  y: number;       // normalized 0-1
  /** index in 468-point Mediapipe FaceMesh — for face_id step */
  idx: number;
}

export interface DetectionFrame {
  /** Step we're currently in */
  step: DoseFlowStep;
  /** "scanning" | "found" | "verified" */
  phase: "scanning" | "found" | "verified";
  /** Object detections (bbox style) */
  bboxes: BBox[];
  /** Face mesh landmarks (only on face_id step) */
  faceLandmarks: FaceLandmark[];
  /** Scan line progress 0-1 (for scanning visual) */
  scanProgress: number;
  /** Live confidence value 0-1 — drives the big number at top */
  liveConfidence: number;
  /** Free-form log entries (for the side panel) */
  log: { time: number; message: string; level: "info" | "success" | "warn" }[];
}

// ────────────────────────────────────────────────────────────────────────────
// Random helpers (deterministic-ish, for stable bboxes)
// ────────────────────────────────────────────────────────────────────────────

function jitter(base: number, amplitude: number, t: number): number {
  return base + Math.sin(t / 200) * amplitude;
}

// ────────────────────────────────────────────────────────────────────────────
// 468-point face mesh — simulate just key contour points (eyes, nose, mouth, jaw)
// Numbers approximate; for real Mediapipe FaceMesh use actual indices.
// ────────────────────────────────────────────────────────────────────────────

// Reduced from 120 to 32 key points — half the SVG nodes, no visible quality
// loss at viewport size. Real face_id step uses face-api.js 68pt instead.
const FACE_MESH_POINTS = (() => {
  const pts: { x: number; y: number; idx: number }[] = [];
  let idx = 0;
  // Jaw + forehead outline (16 points instead of 36)
  for (let i = 0; i < 16; i++) {
    const angle = (i / 16) * Math.PI * 2;
    pts.push({
      x: 0.5 + Math.cos(angle) * (0.18 + Math.sin(i / 4) * 0.01),
      y: 0.5 + Math.sin(angle) * 0.24,
      idx: idx++,
    });
  }
  // Eyes — 4 points each (was 12) = 8
  for (const c of [{ cx: 0.42, cy: 0.46 }, { cx: 0.58, cy: 0.46 }]) {
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      pts.push({
        x: c.cx + Math.cos(angle) * 0.04,
        y: c.cy + Math.sin(angle) * 0.018,
        idx: idx++,
      });
    }
  }
  // Nose — 3 points (was 8)
  for (let i = 0; i < 3; i++) pts.push({ x: 0.5, y: 0.5 + i * 0.04, idx: idx++ });
  // Mouth — 5 points (was 16)
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    pts.push({
      x: 0.5 + Math.cos(angle) * 0.06,
      y: 0.62 + Math.sin(angle) * 0.022,
      idx: idx++,
    });
  }
  return pts;
})();

// ────────────────────────────────────────────────────────────────────────────
// Per-step generator
// ────────────────────────────────────────────────────────────────────────────

export function generateDetectionFrame(
  step: DoseFlowStep,
  elapsedMs: number,
  expectedPillCount = 4,
): DetectionFrame {
  const t = elapsedMs;
  const log: DetectionFrame["log"] = [];

  // Phase progresses by elapsed time
  const phase: DetectionFrame["phase"] =
    t < 1500 ? "scanning" : t < 3500 ? "found" : "verified";

  const scanProgress = Math.min(1, (t % 2500) / 2500);

  switch (step) {
    case "face_id": {
      const visiblePoints =
        t < 1000 ? 0 :
        t < 1800 ? Math.floor((FACE_MESH_POINTS.length * (t - 1000)) / 800) :
        FACE_MESH_POINTS.length;

      const bbox: BBox = {
        id: "face",
        bbox: [
          jitter(0.3, 0.005, t),
          jitter(0.18, 0.005, t),
          jitter(0.7, 0.005, t),
          jitter(0.78, 0.005, t),
        ],
        label: phase === "verified" ? "Patient #1 · Sardor T." : phase === "found" ? "Face detected" : "Scanning…",
        confidence: phase === "verified" ? 0.94 : phase === "found" ? 0.78 : 0.4,
        color: "#0EA5A4",
        state: phase === "verified" ? "verified" : phase === "found" ? "tracked" : "detecting",
      };

      if (t > 800 && t < 900) log.push({ time: t, message: "Face contour detected", level: "info" });
      if (t > 1700 && t < 1800) log.push({ time: t, message: "468 facial landmarks tracked", level: "info" });
      if (t > 2400 && t < 2500) log.push({ time: t, message: "Computing embedding (512-dim vector)", level: "info" });
      if (t > 3300 && t < 3400) log.push({ time: t, message: "Cosine similarity vs enrolled: 0.94", level: "success" });
      if (t > 3500 && t < 3600) log.push({ time: t, message: "Identity verified ✓", level: "success" });

      return {
        step,
        phase,
        bboxes: [bbox],
        faceLandmarks: FACE_MESH_POINTS.slice(0, visiblePoints),
        scanProgress,
        liveConfidence: bbox.confidence,
        log,
      };
    }

    case "show_box": {
      const detected = t > 1200;
      const bbox: BBox = {
        id: "ascorutin-box",
        bbox: [
          jitter(0.22, 0.012, t),
          jitter(0.32, 0.008, t),
          jitter(0.78, 0.012, t),
          jitter(0.74, 0.008, t),
        ],
        label: phase === "verified" ? "Ascorutin N50 · ЛЕКХИМ" : phase === "found" ? "Pill box detected" : "Looking for box…",
        confidence: phase === "verified" ? 0.92 : phase === "found" ? 0.72 : 0.35,
        color: "#F59E5B",
        state: phase === "verified" ? "verified" : phase === "found" ? "tracked" : "detecting",
      };
      if (t > 800) log.push({ time: t, message: "YOLO detection: object class candidate", level: "info" });
      if (t > 1400) log.push({ time: t, message: "Bounding box stabilized (IoU > 0.85)", level: "info" });
      if (t > 2200) log.push({ time: t, message: "OCR: text 'АСКОРУТИН' matched", level: "info" });
      if (t > 3000) log.push({ time: t, message: "Drug match: Ascorutin N50 ✓", level: "success" });

      return {
        step,
        phase,
        bboxes: detected ? [bbox] : [],
        faceLandmarks: [],
        scanProgress,
        liveConfidence: bbox.confidence,
        log,
      };
    }

    case "open_box": {
      // Show box bbox + new "blister" bbox once "opened"
      const boxBox: BBox = {
        id: "box",
        bbox: [0.18, 0.28, 0.55, 0.74],
        label: "Box (open)",
        confidence: 0.88,
        color: "#F59E5B",
        state: "tracked",
      };
      const blister: BBox | null = t > 1500 ? {
        id: "blister",
        bbox: [jitter(0.55, 0.01, t), 0.34, 0.85, 0.68],
        label: phase === "verified" ? "Blister sheet" : "Detecting…",
        confidence: phase === "verified" ? 0.86 : 0.55,
        color: "#10B981",
        state: phase === "verified" ? "verified" : "tracked",
      } : null;
      if (t > 1500) log.push({ time: t, message: "Action detected: lid opening", level: "info" });
      if (t > 2400) log.push({ time: t, message: "Blister visible inside box", level: "success" });
      return {
        step,
        phase,
        bboxes: blister ? [boxBox, blister] : [boxBox],
        faceLandmarks: [],
        scanProgress,
        liveConfidence: blister?.confidence ?? boxBox.confidence,
        log,
      };
    }

    case "show_pills": {
      const palmBox: BBox = {
        id: "palm",
        bbox: [0.2, 0.52, 0.78, 0.92],
        label: "Open palm",
        confidence: 0.91,
        color: "#A78BFA",
        state: "tracked",
      };
      const pillBoxes: BBox[] = [];
      const visible = phase === "scanning" ? 0 : phase === "found" ? Math.min(expectedPillCount, 2) : expectedPillCount;
      for (let i = 0; i < visible; i++) {
        const cx = 0.32 + (i / Math.max(1, expectedPillCount - 1)) * 0.36;
        pillBoxes.push({
          id: `pill-${i}`,
          bbox: [cx - 0.04, jitter(0.66, 0.006, t + i * 100), cx + 0.04, jitter(0.78, 0.006, t + i * 100)],
          label: `Pill ${i + 1}`,
          confidence: 0.85 + Math.random() * 0.1,
          color: "#FBBF24",
          state: phase === "verified" ? "verified" : "tracked",
        });
      }
      if (t > 800) log.push({ time: t, message: "Mediapipe Hands: palm landmark 21pt", level: "info" });
      if (t > 1500) log.push({ time: t, message: "YOLO pill detector active", level: "info" });
      if (t > 2200) log.push({ time: t, message: `Detected ${visible} pills`, level: phase === "verified" ? "success" : "info" });
      if (t > 3200 && phase === "verified") log.push({ time: t, message: `Count matches prescription (${expectedPillCount}) ✓`, level: "success" });

      return {
        step,
        phase,
        bboxes: [palmBox, ...pillBoxes],
        faceLandmarks: [],
        scanProgress,
        liveConfidence: 0.88,
        log,
      };
    }

    case "pill_closeup": {
      const pill: BBox = {
        id: "closeup",
        bbox: [0.28, 0.28, 0.72, 0.72],
        label: phase === "verified" ? "Round yellow-green pill — Ascorutin match" : "Analyzing pill…",
        confidence: phase === "verified" ? 0.91 : phase === "found" ? 0.74 : 0.42,
        color: "#FBBF24",
        state: phase === "verified" ? "verified" : phase === "found" ? "tracked" : "detecting",
      };
      if (t > 800) log.push({ time: t, message: "Vision LLM (Qwen-VL 7B) inference start", level: "info" });
      if (t > 1800) log.push({ time: t, message: "Color: yellow-green dominant", level: "info" });
      if (t > 2400) log.push({ time: t, message: "Shape: round, flat, ~7mm diameter", level: "info" });
      if (t > 3200) log.push({ time: t, message: "Match: Ascorutin (Vit C + Rutin) ✓", level: "success" });
      return {
        step,
        phase,
        bboxes: [pill],
        faceLandmarks: [],
        scanProgress,
        liveConfidence: pill.confidence,
        log,
      };
    }

    case "show_glass": {
      const glass: BBox = {
        id: "glass",
        bbox: [jitter(0.38, 0.005, t), jitter(0.22, 0.005, t), jitter(0.62, 0.005, t), jitter(0.85, 0.005, t)],
        label: phase === "verified" ? "Transparent glass · water visible" : "Detecting glass…",
        confidence: phase === "verified" ? 0.89 : phase === "found" ? 0.7 : 0.42,
        color: "#0EA5A4",
        state: phase === "verified" ? "verified" : phase === "found" ? "tracked" : "detecting",
      };
      if (t > 1200) log.push({ time: t, message: "Object shape: cylinder", level: "info" });
      if (t > 2000) log.push({ time: t, message: "Translucency check: passed", level: "info" });
      if (t > 2800) log.push({ time: t, message: "Liquid surface detected (meniscus)", level: "info" });
      if (t > 3500) log.push({ time: t, message: "Glass with water confirmed ✓", level: "success" });
      return {
        step,
        phase,
        bboxes: [glass],
        faceLandmarks: [],
        scanProgress,
        liveConfidence: glass.confidence,
        log,
      };
    }

    case "swallow": {
      const handToMouth: BBox = {
        id: "h2m",
        bbox: [0.35, 0.35, 0.65, 0.7],
        label: phase === "verified" ? "Swallow detected" : "Tracking hand-to-mouth motion",
        confidence: phase === "verified" ? 0.86 : 0.62,
        color: "#EF4444",
        state: phase === "verified" ? "verified" : "detecting",
      };
      if (t > 600) log.push({ time: t, message: "Optical flow: hand → mouth trajectory", level: "info" });
      if (t > 1500) log.push({ time: t, message: "Pill no longer visible in palm", level: "info" });
      if (t > 2300) log.push({ time: t, message: "Drinking motion (head tilt + cup angle)", level: "info" });
      if (t > 3200) log.push({ time: t, message: "Swallow gesture confirmed", level: "success" });
      return {
        step,
        phase,
        bboxes: [handToMouth],
        faceLandmarks: [],
        scanProgress,
        liveConfidence: handToMouth.confidence,
        log,
      };
    }

    case "mouth_check": {
      const mouth: BBox = {
        id: "mouth",
        bbox: [0.36, 0.55, 0.64, 0.75],
        label: phase === "verified" ? "Mouth empty (no pill residue)" : "Inspecting oral cavity",
        confidence: phase === "verified" ? 0.88 : 0.65,
        color: "#10B981",
        state: phase === "verified" ? "verified" : "detecting",
      };
      if (t > 600) log.push({ time: t, message: "Mouth-open detected (lip distance > threshold)", level: "info" });
      if (t > 1400) log.push({ time: t, message: "Tongue surface scan", level: "info" });
      if (t > 2200) log.push({ time: t, message: "Under-tongue area scan", level: "info" });
      if (t > 3000) log.push({ time: t, message: "No pill residue detected ✓", level: "success" });
      return {
        step,
        phase,
        bboxes: [mouth],
        faceLandmarks: [],
        scanProgress,
        liveConfidence: mouth.confidence,
        log,
      };
    }

    default:
      return {
        step,
        phase: "scanning",
        bboxes: [],
        faceLandmarks: [],
        scanProgress: 0,
        liveConfidence: 0,
        log: [],
      };
  }
}
