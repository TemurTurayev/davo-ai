"use client";

import { memo } from "react";

/**
 * Detection Overlay — SVG drawn on top of the live video.
 *
 * Render priority (per-step):
 *   1. face_id   → REAL face-api bbox + 68 landmarks. NO mock anything.
 *   2. show_pills, pill_closeup, swallow, mouth_check → REAL Mediapipe Hands
 *      bbox + 21 landmarks per hand. NO mock pills.
 *   3. show_box, open_box, show_glass → NO bbox (no real client-side detector
 *      available; would need server YOLO). Just scan-line + corner brackets so
 *      jury sees "AI is watching" without lying about objects we haven't seen.
 *
 * Always-on: animated scan line (when isScanning), corner viewfinder brackets,
 * subtle grid texture.
 */

import { motion, AnimatePresence } from "framer-motion";
import type { FaceTracking } from "@/lib/use-face-tracker";
import type { HandTracking } from "@/lib/use-hand-tracker";
import type { ObjectDetection } from "@/lib/use-object-detector";
import type { DoseFlowStep } from "@/lib/store";

interface DetectionOverlayProps {
  scanProgress: number;
  isScanning: boolean;
  /** Mirror to match the mirrored selfie video */
  mirrored?: boolean;
  /** Real face-api detection (used on face_id step) */
  realTracking?: FaceTracking;
  /** Real Mediapipe Hands detection (used on hand-related steps) */
  handTracking?: HandTracking;
  /** Real Mediapipe ObjectDetector (used on box/glass steps) */
  objectDetection?: ObjectDetection;
  /** Current step — drives which detection layer to render */
  step?: DoseFlowStep;
}

const W = 1000;
const H = 1000;

const HAND_RELATED_STEPS = new Set<DoseFlowStep>([
  "pill_closeup",
  "swallow",
  "mouth_check",
]);

const OBJECT_RELATED_STEPS = new Set<DoseFlowStep>([
  "show_box",
  "show_glass",
]);

export const DetectionOverlay = memo(DetectionOverlayInner);

function DetectionOverlayInner({
  scanProgress,
  isScanning,
  mirrored = true,
  realTracking,
  handTracking,
  objectDetection,
  step,
}: DetectionOverlayProps) {
  const showFace = step === "face_id" && realTracking?.detected;
  const showHands =
    step !== undefined &&
    HAND_RELATED_STEPS.has(step) &&
    handTracking?.detected &&
    handTracking.hands.length > 0;
  const showObjects =
    step !== undefined &&
    OBJECT_RELATED_STEPS.has(step) &&
    objectDetection?.detected &&
    objectDetection.objects.length > 0;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ transform: mirrored ? "scaleX(-1)" : undefined }}
    >
      <defs>
        <linearGradient id="scan-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(14, 165, 164, 0)" />
          <stop offset="40%" stopColor="rgba(14, 165, 164, 0.4)" />
          <stop offset="50%" stopColor="rgba(94, 234, 212, 0.95)" />
          <stop offset="60%" stopColor="rgba(14, 165, 164, 0.4)" />
          <stop offset="100%" stopColor="rgba(14, 165, 164, 0)" />
        </linearGradient>
        <filter id="verify-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feFlood floodColor="#10B981" floodOpacity="0.6" />
          <feComposite in2="blur" operator="in" />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <pattern id="grid-pattern" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(14, 165, 164, 0.06)" strokeWidth="0.5" />
        </pattern>
      </defs>

      <rect width="100%" height="100%" fill="url(#grid-pattern)" />
      <CornerBrackets active={isScanning} />

      {isScanning && (
        <motion.rect
          x={0}
          y={scanProgress * H - 80}
          width={W}
          height={160}
          fill="url(#scan-grad)"
        />
      )}

      <AnimatePresence>
        {/* Face mesh dots removed per user feedback — only bbox + label follows the face */}
        {showFace && <RealFaceBBox key="face-bbox" tracking={realTracking!} mirrored={mirrored} />}
        {showHands && handTracking!.hands.map((h, i) => (
          <RealHandLayer key={`hand-${i}`} hand={h} mirrored={mirrored} index={i} />
        ))}
        {showObjects && objectDetection!.objects.slice(0, 3).map((obj, i) => (
          <RealObjectBBox key={`obj-${i}`} object={obj} mirrored={mirrored} index={i} />
        ))}
      </AnimatePresence>
    </svg>
  );
}

function CornerBrackets({ active }: { active: boolean }) {
  const inset = 30;
  const len = 48;
  const stroke = active ? "#5EEAD4" : "rgba(255,255,255,0.4)";
  const sw = active ? 4 : 2.5;
  const make = (x1: number, y1: number, x2: number, y2: number) => (
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
  );
  return (
    <g>
      {make(inset, inset, inset + len, inset)}
      {make(inset, inset, inset, inset + len)}
      {make(W - inset - len, inset, W - inset, inset)}
      {make(W - inset, inset, W - inset, inset + len)}
      {make(inset, H - inset, inset + len, H - inset)}
      {make(inset, H - inset - len, inset, H - inset)}
      {make(W - inset - len, H - inset, W - inset, H - inset)}
      {make(W - inset, H - inset - len, W - inset, H - inset)}
    </g>
  );
}

function RealFaceMesh({ tracking }: { tracking: FaceTracking }) {
  return (
    <g>
      {tracking.landmarks.map((p, i) => (
        <circle key={i} cx={p.x * W} cy={p.y * H} r={2.5} fill="#5EEAD4" opacity={0.85} />
      ))}
    </g>
  );
}

function RealFaceBBox({ tracking, mirrored }: { tracking: FaceTracking; mirrored: boolean }) {
  if (!tracking.box) return null;
  const { x, y, width, height } = tracking.box;
  const px = x * W;
  const py = y * H;
  const pw = width * W;
  const ph = height * H;

  const verified = tracking.score > 0.85;
  const stroke = verified ? "#10B981" : "#0EA5A4";
  const label = verified ? "Patient · verified" : "Tracking face…";
  const conf = Math.round(tracking.score * 100);
  const labelW = Math.max(180, label.length * 9 + 60);

  return (
    <motion.g initial={{ opacity: 0 }} animate={{ opacity: 0.95 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
      <rect
        x={px}
        y={py}
        width={pw}
        height={ph}
        fill="none"
        stroke={stroke}
        strokeWidth={5}
        rx={12}
        filter={verified ? "url(#verify-glow)" : undefined}
      />
      <g transform={mirrored ? `translate(${W}, 0) scale(-1, 1)` : ""}>
        <rect
          x={mirrored ? W - px - labelW : px}
          y={Math.max(0, py - 36)}
          width={labelW}
          height={32}
          rx={8}
          fill={stroke}
          opacity={0.95}
        />
        <text
          x={(mirrored ? W - px - labelW : px) + 12}
          y={py - 14}
          fontSize={16}
          fontFamily="JetBrains Mono, monospace"
          fontWeight={700}
          fill="white"
        >
          {label}
        </text>
        <text
          x={(mirrored ? W - px - 12 : px + labelW - 12)}
          y={py - 14}
          fontSize={14}
          fontFamily="JetBrains Mono, monospace"
          fontWeight={700}
          fill="white"
          textAnchor="end"
        >
          {conf}%
        </text>
      </g>
    </motion.g>
  );
}

/** Mediapipe ObjectDetector — generic object bbox (book, cup, bottle, cell phone…)
 *  Used as proxy for "patient is holding something" on box/glass steps. Real
 *  brand recognition (Ascorutin/Trahisan) needs server-side YOLO. */
function RealObjectBBox({
  object,
  mirrored,
  index,
}: {
  object: ObjectDetection["objects"][number];
  mirrored: boolean;
  index: number;
}) {
  const { box, label, confidence } = object;
  const px = box.x * W;
  const py = box.y * H;
  const pw = box.width * W;
  const ph = box.height * H;

  // Color cycle so multiple detections distinguish visually
  const palette = ["#F59E5B", "#0EA5E9", "#84CC16"];
  const stroke = palette[index % palette.length];
  const conf = Math.round(confidence * 100);
  const labelText = `${label}`;
  const labelW = Math.max(120, labelText.length * 9 + 50);

  return (
    <motion.g initial={{ opacity: 0 }} animate={{ opacity: 0.92 }} exit={{ opacity: 0 }}>
      <rect
        x={px}
        y={py}
        width={pw}
        height={ph}
        fill="none"
        stroke={stroke}
        strokeWidth={4}
        strokeDasharray="14 8"
        rx={8}
      />
      <g transform={mirrored ? `translate(${W}, 0) scale(-1, 1)` : ""}>
        <rect
          x={mirrored ? W - px - labelW : px}
          y={Math.max(0, py - 36)}
          width={labelW}
          height={32}
          rx={8}
          fill={stroke}
          opacity={0.95}
        />
        <text
          x={(mirrored ? W - px - labelW : px) + 12}
          y={py - 14}
          fontSize={15}
          fontFamily="JetBrains Mono, monospace"
          fontWeight={700}
          fill="white"
        >
          {labelText}
        </text>
        <text
          x={(mirrored ? W - px - 12 : px + labelW - 12)}
          y={py - 14}
          fontSize={13}
          fontFamily="JetBrains Mono, monospace"
          fontWeight={700}
          fill="white"
          textAnchor="end"
        >
          {conf}%
        </text>
      </g>
    </motion.g>
  );
}

/** Mediapipe Hands detection — bbox + 21 landmarks per hand */
function RealHandLayer({
  hand,
  mirrored,
  index,
}: {
  hand: HandTracking["hands"][number];
  mirrored: boolean;
  index: number;
}) {
  const { box, landmarks, handedness, confidence } = hand;
  const px = box.x * W;
  const py = box.y * H;
  const pw = box.width * W;
  const ph = box.height * H;

  const stroke = index === 0 ? "#A78BFA" : "#F472B6";
  const label = `${handedness} hand`;
  const conf = Math.round(confidence * 100);
  const labelW = Math.max(140, label.length * 9 + 50);

  // 21-point hand landmark connections (Mediapipe ordering)
  const CONNECTIONS: [number, number][] = [
    [0, 1], [1, 2], [2, 3], [3, 4],         // thumb
    [0, 5], [5, 6], [6, 7], [7, 8],          // index
    [0, 9], [9, 10], [10, 11], [11, 12],     // middle
    [0, 13], [13, 14], [14, 15], [15, 16],   // ring
    [0, 17], [17, 18], [18, 19], [19, 20],   // pinky
    [5, 9], [9, 13], [13, 17],               // palm
  ];

  return (
    <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      {/* Bounding box — beefier (was 4px stroke, now 6) */}
      <rect
        x={px}
        y={py}
        width={pw}
        height={ph}
        fill="none"
        stroke={stroke}
        strokeWidth={6}
        rx={14}
        filter="drop-shadow(0 0 8px rgba(167, 139, 250, 0.6))"
      />
      {/* Skeleton lines — thicker + full opacity (was 2px @ 70%, now 4px @ 100%) */}
      {CONNECTIONS.map(([a, b], i) => (
        <line
          key={i}
          x1={landmarks[a].x * W}
          y1={landmarks[a].y * H}
          x2={landmarks[b].x * W}
          y2={landmarks[b].y * H}
          stroke={stroke}
          strokeWidth={4}
          strokeOpacity={1}
          strokeLinecap="round"
        />
      ))}
      {/* Joints — bigger (wrist 5→8, others 3→5) */}
      {landmarks.map((p, i) => (
        <circle
          key={i}
          cx={p.x * W}
          cy={p.y * H}
          r={i === 0 ? 8 : 5}
          fill={stroke}
          stroke="white"
          strokeWidth={1.5}
          opacity={1}
        />
      ))}
      {/* Label */}
      <g transform={mirrored ? `translate(${W}, 0) scale(-1, 1)` : ""}>
        <rect
          x={mirrored ? W - px - labelW : px}
          y={Math.max(0, py - 36)}
          width={labelW}
          height={32}
          rx={8}
          fill={stroke}
          opacity={0.95}
        />
        <text
          x={(mirrored ? W - px - labelW : px) + 12}
          y={py - 14}
          fontSize={14}
          fontFamily="JetBrains Mono, monospace"
          fontWeight={700}
          fill="white"
        >
          {label}
        </text>
        <text
          x={(mirrored ? W - px - 12 : px + labelW - 12)}
          y={py - 14}
          fontSize={13}
          fontFamily="JetBrains Mono, monospace"
          fontWeight={700}
          fill="white"
          textAnchor="end"
        >
          {conf}%
        </text>
      </g>
    </motion.g>
  );
}
