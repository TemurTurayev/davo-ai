"use client";

/**
 * Detection Overlay — SVG layer drawn on top of the live video.
 *
 * Renders:
 *  - Animated scan line (laser bar moving down) when AI is "scanning"
 *  - Corner viewfinder brackets (always)
 *  - BBoxes with labels + confidence — animated state transitions
 *      detecting (dashed, low opacity) → tracked (solid, medium) → verified (solid, glow)
 *  - Face mesh dots (468-point Mediapipe-style) on face_id step
 *  - Subtle grid texture for "AI is watching" feel
 *
 * Coordinates are normalized 0-1, projected onto SVG viewBox 0-1000 / 0-1000.
 */

import { motion, AnimatePresence } from "framer-motion";
import type { BBox, FaceLandmark } from "@/lib/mock-detections";

interface DetectionOverlayProps {
  bboxes: BBox[];
  faceLandmarks: FaceLandmark[];
  scanProgress: number;        // 0-1
  isScanning: boolean;
  /** Mirror the overlay horizontally to match mirrored video (selfie convention) */
  mirrored?: boolean;
}

const W = 1000;
const H = 1000;

export function DetectionOverlay({
  bboxes,
  faceLandmarks,
  scanProgress,
  isScanning,
  mirrored = true,
}: DetectionOverlayProps) {
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ transform: mirrored ? "scaleX(-1)" : undefined }}
    >
      <defs>
        {/* Scan line gradient — bright cyan band fading to transparent */}
        <linearGradient id="scan-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(14, 165, 164, 0)" />
          <stop offset="40%" stopColor="rgba(14, 165, 164, 0.4)" />
          <stop offset="50%" stopColor="rgba(94, 234, 212, 0.95)" />
          <stop offset="60%" stopColor="rgba(14, 165, 164, 0.4)" />
          <stop offset="100%" stopColor="rgba(14, 165, 164, 0)" />
        </linearGradient>

        {/* Verified glow filter */}
        <filter id="verify-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feFlood floodColor="#10B981" floodOpacity="0.6" />
          <feComposite in2="blur" operator="in" />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Subtle grid pattern — "AI eye" feel */}
        <pattern id="grid-pattern" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(14, 165, 164, 0.06)" strokeWidth="0.5" />
        </pattern>
      </defs>

      {/* Background grid (always visible) */}
      <rect width="100%" height="100%" fill="url(#grid-pattern)" />

      {/* Corner viewfinder brackets */}
      <CornerBrackets active={isScanning} />

      {/* Scan line (animated when scanning) */}
      {isScanning && (
        <motion.rect
          x={0}
          y={scanProgress * H - 80}
          width={W}
          height={160}
          fill="url(#scan-grad)"
        />
      )}

      {/* Face landmarks (face_id step) */}
      {faceLandmarks.length > 0 && (
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

      {/* BBoxes */}
      <AnimatePresence>
        {bboxes.map((b) => (
          <BBoxRect key={b.id} bbox={b} mirrored={mirrored} />
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
      {/* Top-left */}
      {make(inset, inset, inset + len, inset)}
      {make(inset, inset, inset, inset + len)}
      {/* Top-right */}
      {make(W - inset - len, inset, W - inset, inset)}
      {make(W - inset, inset, W - inset, inset + len)}
      {/* Bottom-left */}
      {make(inset, H - inset, inset + len, H - inset)}
      {make(inset, H - inset - len, inset, H - inset)}
      {/* Bottom-right */}
      {make(W - inset - len, H - inset, W - inset, H - inset)}
      {make(W - inset, H - inset - len, W - inset, H - inset)}
    </g>
  );
}

function BBoxRect({ bbox, mirrored }: { bbox: BBox; mirrored: boolean }) {
  const [x1, y1, x2, y2] = bbox.bbox;
  const x = x1 * W;
  const y = y1 * H;
  const w = (x2 - x1) * W;
  const h = (y2 - y1) * H;

  const strokeColor = bbox.state === "verified" ? "#10B981" : bbox.state === "tracked" ? bbox.color : bbox.color;
  const strokeWidth = bbox.state === "verified" ? 5 : 4;
  const dash = bbox.state === "detecting" ? "16 10" : "0";
  const opacity = bbox.state === "detecting" ? 0.7 : 0.95;

  // Label position — top-left, mirrored if needed
  const labelX = mirrored ? W - x : x;
  const labelY = y - 14;

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
      {/* Confidence corner pill — drawn UN-mirrored on top by inverting the parent flip */}
      <g transform={mirrored ? `translate(${W}, 0) scale(-1, 1)` : ""}>
        <rect
          x={mirrored ? W - x - 200 : x}
          y={Math.max(0, labelY - 28)}
          width={Math.min(220, Math.max(140, bbox.label.length * 9 + 60))}
          height={32}
          rx={8}
          fill={bbox.state === "verified" ? "#10B981" : strokeColor}
          opacity={0.95}
        />
        <text
          x={(mirrored ? W - x - 200 : x) + 12}
          y={labelY - 8}
          fontSize={16}
          fontFamily="JetBrains Mono, monospace"
          fontWeight={700}
          fill="white"
        >
          {bbox.label}
        </text>
        <text
          x={(mirrored ? W - x - 200 : x) + Math.min(190, Math.max(110, bbox.label.length * 9 + 30))}
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
