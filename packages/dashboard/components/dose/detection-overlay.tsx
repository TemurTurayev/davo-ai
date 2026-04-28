"use client";

import { memo } from "react";

/**
 * Detection Overlay — SVG drawn on top of the live video.
 *
 * Two render modes:
 *  - Mock mode (default): static face mesh dots + jittered bboxes from
 *    `lib/mock-detections.ts`. Used for non-face_id steps and when face-api
 *    hasn't initialized yet.
 *  - Real mode: when `realTracking.detected` is true, replaces the mock
 *    face mesh with actual 68-point landmarks from face-api.js, and the
 *    bbox follows the real face.
 *
 * Always-on: animated scan line, corner viewfinder brackets, grid texture.
 */

import { motion, AnimatePresence } from "framer-motion";
import type { BBox, FaceLandmark } from "@/lib/mock-detections";
import type { FaceTracking } from "@/lib/use-face-tracker";

interface DetectionOverlayProps {
  bboxes: BBox[];
  faceLandmarks: FaceLandmark[];
  scanProgress: number;
  isScanning: boolean;
  /** Mirror the overlay horizontally to match the mirrored selfie video */
  mirrored?: boolean;
  /** When provided + detected, takes precedence over mock face mesh on face_id step */
  realTracking?: FaceTracking;
  /** Step we're on — used to decide whether real tracker should override mock */
  step?: string;
}

const W = 1000;
const H = 1000;

export const DetectionOverlay = memo(DetectionOverlayInner);

function DetectionOverlayInner({
  bboxes,
  faceLandmarks,
  scanProgress,
  isScanning,
  mirrored = true,
  realTracking,
  step,
}: DetectionOverlayProps) {
  // On face_id step, prefer real face-api tracking when face is detected
  const useRealFace = step === "face_id" && realTracking?.detected && realTracking.box;

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

      {/* REAL face mesh — takes precedence on face_id step */}
      {useRealFace && (
        <RealFaceMesh tracking={realTracking!} />
      )}

      {/* MOCK face mesh — fallback or non-face steps */}
      {!useRealFace && faceLandmarks.length > 0 && (
        <g>
          {faceLandmarks.map((p) => (
            <motion.circle
              key={p.idx}
              initial={{ opacity: 0, r: 0 }}
              animate={{ opacity: 0.85, r: 2.5 }}
              transition={{ duration: 0.2, delay: p.idx * 0.003 }}
              cx={p.x * W}
              cy={p.y * H}
              fill="#5EEAD4"
            />
          ))}
        </g>
      )}

      {/* BBoxes — replace face bbox with real one when tracking */}
      <AnimatePresence>
        {bboxes
          .filter((b) => !(useRealFace && b.id === "face"))
          .map((b) => (
            <BBoxRect key={b.id} bbox={b} mirrored={mirrored} />
          ))}
        {useRealFace && (
          <RealFaceBBox key="real-face" tracking={realTracking!} mirrored={mirrored} />
        )}
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

/** Renders the 68-point face mesh from face-api.js, following the real face */
function RealFaceMesh({ tracking }: { tracking: FaceTracking }) {
  return (
    <g>
      {tracking.landmarks.map((p, i) => (
        <circle
          key={i}
          cx={p.x * W}
          cy={p.y * H}
          r={2.2}
          fill="#5EEAD4"
          opacity={0.9}
        />
      ))}
    </g>
  );
}

/** Renders bbox that follows the real face position */
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

  return (
    <motion.g
      initial={{ opacity: 0 }}
      animate={{ opacity: 0.95 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
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
      {/* Label — counter-mirrored so text reads correctly even when overlay is mirrored */}
      <g transform={mirrored ? `translate(${W}, 0) scale(-1, 1)` : ""}>
        <rect
          x={mirrored ? W - px - Math.max(180, label.length * 9 + 60) : px}
          y={Math.max(0, py - 36)}
          width={Math.max(180, label.length * 9 + 60)}
          height={32}
          rx={8}
          fill={stroke}
          opacity={0.95}
        />
        <text
          x={(mirrored ? W - px - Math.max(180, label.length * 9 + 60) : px) + 12}
          y={py - 14}
          fontSize={16}
          fontFamily="JetBrains Mono, monospace"
          fontWeight={700}
          fill="white"
        >
          {label}
        </text>
        <text
          x={(mirrored ? W - px - 12 : px + Math.max(180, label.length * 9 + 60) - 12)}
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

function BBoxRect({ bbox, mirrored }: { bbox: BBox; mirrored: boolean }) {
  const [x1, y1, x2, y2] = bbox.bbox;
  const x = x1 * W;
  const y = y1 * H;
  const w = (x2 - x1) * W;
  const h = (y2 - y1) * H;
  const strokeColor = bbox.state === "verified" ? "#10B981" : bbox.color;
  const strokeWidth = bbox.state === "verified" ? 5 : 4;
  const dash = bbox.state === "detecting" ? "16 10" : "0";
  const opacity = bbox.state === "detecting" ? 0.7 : 0.95;
  const labelY = y - 14;
  const labelW = Math.min(220, Math.max(140, bbox.label.length * 9 + 60));

  return (
    <motion.g
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeDasharray={dash}
        rx={12}
        filter={bbox.state === "verified" ? "url(#verify-glow)" : undefined}
      />
      <g transform={mirrored ? `translate(${W}, 0) scale(-1, 1)` : ""}>
        <rect
          x={mirrored ? W - x - labelW : x}
          y={Math.max(0, labelY - 28)}
          width={labelW}
          height={32}
          rx={8}
          fill={bbox.state === "verified" ? "#10B981" : strokeColor}
          opacity={0.95}
        />
        <text
          x={(mirrored ? W - x - labelW : x) + 12}
          y={labelY - 8}
          fontSize={16}
          fontFamily="JetBrains Mono, monospace"
          fontWeight={700}
          fill="white"
        >
          {bbox.label}
        </text>
        <text
          x={(mirrored ? W - x - 12 : x + labelW - 12)}
          y={labelY - 8}
          fontSize={14}
          fontFamily="JetBrains Mono, monospace"
          fontWeight={700}
          fill="white"
          textAnchor="end"
        >
          {Math.round(bbox.confidence * 100)}%
        </text>
      </g>
    </motion.g>
  );
}
