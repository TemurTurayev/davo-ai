"use client";

/**
 * useFrameAnalysis — samples the live <video> at 1 FPS and computes:
 *  - brightness (0-1, average luminance) → "Освещение" rule
 *  - motion (0-1, normalized frame diff) → "Камера стабильна" rule
 *
 * Real signals — replaces the random mock that lit all rules green
 * regardless of what's actually in front of the camera.
 *
 * Cheap: downsamples to 64×64 grayscale for both checks.
 */

import { useEffect, useRef, useState, type RefObject } from "react";

export interface FrameAnalysis {
  /** Average luminance 0-1 (≥0.3 = good light, <0.2 = too dark) */
  brightness: number;
  /** Normalized motion 0-1 (<0.05 = stable, >0.2 = shaking) */
  motion: number;
  /** Whether enough frames sampled to trust the signals */
  ready: boolean;
}

const SAMPLE_SIZE = 64;
const EMPTY: FrameAnalysis = { brightness: 0, motion: 0, ready: false };

export function useFrameAnalysis(
  videoRef: RefObject<HTMLVideoElement | null>,
  enabled: boolean,
): FrameAnalysis {
  const [analysis, setAnalysis] = useState<FrameAnalysis>(EMPTY);
  const prevFrameRef = useRef<Uint8ClampedArray | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!enabled) {
      setAnalysis(EMPTY);
      prevFrameRef.current = null;
      return;
    }

    if (!canvasRef.current) {
      canvasRef.current = document.createElement("canvas");
      canvasRef.current.width = SAMPLE_SIZE;
      canvasRef.current.height = SAMPLE_SIZE;
    }
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    let cancelled = false;
    let frameCount = 0;

    const tick = () => {
      if (cancelled) return;
      const video = videoRef.current;
      if (video && video.videoWidth > 0) {
        // Downsample to 64×64 grayscale
        ctx.drawImage(video, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
        const imgData = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
        const data = imgData.data;

        // Brightness: average luminance (Rec.601)
        let lumSum = 0;
        const gray = new Uint8ClampedArray(SAMPLE_SIZE * SAMPLE_SIZE);
        for (let i = 0; i < gray.length; i++) {
          const r = data[i * 4];
          const g = data[i * 4 + 1];
          const b = data[i * 4 + 2];
          const y = 0.299 * r + 0.587 * g + 0.114 * b;
          gray[i] = y;
          lumSum += y;
        }
        const brightness = lumSum / (gray.length * 255);

        // Motion: mean abs difference vs prev frame, normalized
        let motion = 0;
        if (prevFrameRef.current) {
          let diff = 0;
          for (let i = 0; i < gray.length; i++) {
            diff += Math.abs(gray[i] - prevFrameRef.current[i]);
          }
          motion = diff / (gray.length * 255);
        }
        prevFrameRef.current = gray;

        frameCount++;
        setAnalysis({
          brightness,
          motion,
          ready: frameCount >= 2, // need 2 frames before motion is meaningful
        });
      }
    };

    const interval = setInterval(tick, 1000); // 1 FPS — cheap & enough
    tick(); // first sample immediately

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [enabled, videoRef]);

  return analysis;
}
